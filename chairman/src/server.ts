import express, { type NextFunction, type Request, type Response } from 'express';
import dotenv from 'dotenv';
import { z } from 'zod';
import { OllamaClient, type OllamaMessage } from './ollamaClient';
import { CHAIRMAN_SYSTEM_PROMPT } from './prompts';
import { SynthesizeRequestSchema, SynthesizeResponseSchema } from './schemas';
import { estimateTokenUsage } from './tokenUsage';

dotenv.config();

const chairmanId = process.env.CHAIRMAN_ID || 'chairman-1';
const modelName = process.env.MODEL_NAME;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const portValue = Number.parseInt(process.env.PORT ?? '', 10);
const port = Number.isNaN(portValue) ? 9100 : portValue;
const timeoutValue = Number.parseInt(process.env.TIMEOUT_MS ?? '', 10);
const timeoutMs = Number.isNaN(timeoutValue) ? 90000 : timeoutValue;

if (!modelName) {
  console.error('MODEL_NAME is required. Set it in .env or the environment.');
  process.exit(1);
}

const client = new OllamaClient({
  baseUrl: ollamaBaseUrl,
  model: modelName,
  timeoutMs
});

const ModelOutputSchema = z.object({
  final_answer: z.string().min(1),
  rationale: z.string().min(1),
  used_signals: z.object({
    top_ranked: z.array(z.string()),
    disagreements: z.array(z.string()),
    notes: z.array(z.string())
  })
});

type ReviewEntry = z.infer<typeof SynthesizeRequestSchema>['reviews'][number];

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(err);
});

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function formatReviews(reviews: ReviewEntry[]): string {
  if (reviews.length === 0) {
    return 'No reviews available.';
  }

  return reviews
    .map((review, index) => {
      const reviewer = review.reviewer_anon ? `Reviewer ${review.reviewer_anon}` : `Reviewer ${index + 1}`;
      const rankings = review.rankings?.length ? review.rankings.join(', ') : 'none';
      const critiques = review.critiques
        ? Object.entries(review.critiques)
            .map(([anonId, critique]) => `${anonId}: ${critique}`)
            .join(' | ')
        : 'none';
      const confidence = typeof review.confidence === 'number' ? review.confidence : 'n/a';
      return `${reviewer}\nrankings: ${rankings}\ncritiques: ${critiques}\nconfidence: ${confidence}`;
    })
    .join('\n\n');
}

function buildPrompt(payload: z.infer<typeof SynthesizeRequestSchema>): string {
  const answersBlock = payload.answers
    .map((answer) => `${answer.anon_id}: ${answer.answer_text}`)
    .join('\n\n');

  const rankingBlock = payload.aggregated_ranking
    .map((entry) => `${entry.anon_id}: ${entry.score}`)
    .join('\n');

  return [
    `User query:\n${payload.query}`,
    `Anonymized answers:\n${answersBlock}`,
    `Reviews:\n${formatReviews(payload.reviews)}`,
    `Aggregated ranking (higher score = better):\n${rankingBlock}`,
    'Synthesize a final answer using only the information above. Respect the aggregated ranking as a weighting signal.',
    'Output strict JSON only with keys: final_answer, rationale, used_signals.',
    'used_signals must include: top_ranked (array of anon_id), disagreements (array of anon_id), notes (array of strings).',
    'No markdown.'
  ].join('\n\n');
}

app.get('/health', async (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(`${ollamaBaseUrl.replace(/\/+$/, '')}/api/tags`);
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      const detail = bodyText ? `: ${bodyText}` : '';
      return res.status(503).json({
        ok: false,
        chairman_id: chairmanId,
        model_name: modelName,
        ollama_base_url: ollamaBaseUrl,
        timestamp,
        error: `Ollama responded with ${response.status} ${response.statusText}${detail}`
      });
    }

    return res.json({
      ok: true,
      chairman_id: chairmanId,
      model_name: modelName,
      ollama_base_url: ollamaBaseUrl,
      timestamp
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(503).json({
      ok: false,
      chairman_id: chairmanId,
      model_name: modelName,
      ollama_base_url: ollamaBaseUrl,
      timestamp,
      error: message
    });
  }
});

app.post('/synthesize', async (req: Request, res: Response) => {
  const parsed = SynthesizeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const payload = parsed.data;
  const start = Date.now();
  const prompt = buildPrompt(payload);
  const promptText = `${CHAIRMAN_SYSTEM_PROMPT}\n\n${prompt}`;
  const temperature = payload.options?.temperature ?? 0.3;

  let rawText = '';
  try {
    const messages: OllamaMessage[] = [
      { role: 'system', content: CHAIRMAN_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ];

    rawText = await client.chat(messages, {
      temperature,
      num_predict: 600,
      format: 'json'
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: 'Upstream model error',
      details: message
    });
  }

  const token_usage = estimateTokenUsage(promptText, rawText);
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(rawText);
  } catch {
    const extracted = extractJsonObject(rawText);
    if (!extracted) {
      console.error('Synthesis JSON parse failed; raw output:', rawText);
      return res.status(500).json({
        error: 'Model returned invalid JSON'
      });
    }
    try {
      parsedOutput = JSON.parse(extracted);
    } catch {
      console.error('Synthesis JSON extraction failed; raw output:', rawText);
      return res.status(500).json({
        error: 'Model returned invalid JSON'
      });
    }
  }

  const normalizedOutput =
    parsedOutput && typeof parsedOutput === 'object'
      ? { ...(parsedOutput as Record<string, unknown>) }
      : parsedOutput;

  if (normalizedOutput && typeof normalizedOutput === 'object') {
    const finalAnswerValue = (normalizedOutput as { final_answer?: unknown }).final_answer;
    if (Array.isArray(finalAnswerValue) && finalAnswerValue.every((item) => typeof item === 'string')) {
      (normalizedOutput as { final_answer: string }).final_answer = finalAnswerValue.join(' ');
    } else if (finalAnswerValue && typeof finalAnswerValue === 'object') {
      const parts = Object.values(finalAnswerValue).filter((item) => typeof item === 'string');
      if (parts.length > 0) {
        (normalizedOutput as { final_answer: string }).final_answer = parts.join(' ');
      }
    }
  }

  const outputParsed = ModelOutputSchema.safeParse(normalizedOutput);
  if (!outputParsed.success) {
    console.error('Synthesis output validation failed:', outputParsed.error.issues, 'Raw output:', rawText);
    return res.status(500).json({
      error: 'Model returned invalid synthesis format'
    });
  }

  const responseBody = {
    chairman_id: chairmanId,
    final_answer: outputParsed.data.final_answer,
    rationale: outputParsed.data.rationale,
    used_signals: outputParsed.data.used_signals,
    latency_ms: Date.now() - start,
    token_usage
  };

  const responseParsed = SynthesizeResponseSchema.safeParse(responseBody);
  if (!responseParsed.success) {
    console.error('Synthesis response validation failed:', responseParsed.error.issues);
    return res.status(500).json({ error: 'Response validation failed' });
  }

  return res.json(responseParsed.data);
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Chairman service listening on port ${port}`);
});
