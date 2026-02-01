import express, { type NextFunction, type Request, type Response } from 'express';
import dotenv from 'dotenv';
import { z } from 'zod';
import { OllamaClient, type OllamaMessage } from '../packages/inference/ollamaClient';
import {
  buildAnswerSystemPrompt,
  buildReviewSystemPrompt
} from './prompts';
import {
  AnswerRequestSchema,
  AnswerResponseSchema,
  ReviewRequestSchema,
  ReviewResponseSchema
} from './schemas';
import { estimateTokenUsage } from '../packages/inference/tokenUsage';

dotenv.config();

const memberId = process.env.MEMBER_ID || 'member-1';
const modelName = process.env.MODEL_NAME;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const roleProfile = process.env.ROLE_PROFILE;
const portValue = Number.parseInt(process.env.PORT ?? '', 10);
const port = Number.isNaN(portValue) ? 8001 : portValue;

if (!modelName) {
  console.error('MODEL_NAME is required. Set it in .env or the environment.');
  process.exit(1);
}

const client = new OllamaClient({
  baseUrl: ollamaBaseUrl,
  model: modelName,
  timeoutMs: 60000
});

const ReviewModelOutputSchema = z.object({
  rankings: z.array(z.string()),
  critiques: z.record(z.string()),
  confidence: z.number().min(0).max(1)
});

type PeerAnswer = z.infer<typeof ReviewRequestSchema>['peer_answers'][number];

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

function buildReviewPrompt(query: string, peerAnswers: PeerAnswer[]): string {
  const answersBlock = peerAnswers
    .map((answer) => `${answer.anon_id}: ${answer.answer_text}`)
    .join('\n\n');

  return [
    `User query:\n${query}`,
    `Peer answers:\n${answersBlock}`,
    'Return JSON ONLY with keys: rankings (array of anon_id best->worst), critiques (object anon_id->string), confidence (0..1).'
  ].join('\n\n');
}

function buildFallbackReview(peerAnswers: PeerAnswer[], start: number, token_usage?: ReturnType<typeof estimateTokenUsage>) {
  const rankings = peerAnswers.map((answer) => answer.anon_id);
  const critiques = Object.fromEntries(
    peerAnswers.map((answer) => [answer.anon_id, ''])
  );

  return {
    member_id: memberId,
    rankings,
    critiques,
    confidence: 0.4,
    latency_ms: Date.now() - start,
    token_usage
  };
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
        member_id: memberId,
        model_name: modelName,
        ollama_base_url: ollamaBaseUrl,
        timestamp,
        error: `Ollama responded with ${response.status} ${response.statusText}${detail}`
      });
    }

    return res.json({
      ok: true,
      member_id: memberId,
      model_name: modelName,
      ollama_base_url: ollamaBaseUrl,
      timestamp
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(503).json({
      ok: false,
      member_id: memberId,
      model_name: modelName,
      ollama_base_url: ollamaBaseUrl,
      timestamp,
      error: message
    });
  }
});

app.post('/answer', async (req: Request, res: Response) => {
  const parsed = AnswerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const { query, options } = parsed.data;
  const start = Date.now();

  try {
    const answerSystemPrompt = buildAnswerSystemPrompt(roleProfile);
    const promptText = `${answerSystemPrompt}\n\n${query}`;
    const messages: OllamaMessage[] = [
      { role: 'system', content: answerSystemPrompt },
      { role: 'user', content: query }
    ];

    const answerText = await client.chat(messages, {
      temperature: options?.temperature ?? 0.7,
      num_predict: 512
    });

    const token_usage = estimateTokenUsage(promptText, answerText);
    const responseBody = {
      member_id: memberId,
      answer_text: answerText,
      latency_ms: Date.now() - start,
      token_usage
    };
    const responseParsed = AnswerResponseSchema.safeParse(responseBody);
    if (!responseParsed.success) {
      console.error('Answer response validation failed:', responseParsed.error);
      return res.status(500).json({ error: 'Response validation failed' });
    }

    return res.json(responseParsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: 'Upstream model error',
      details: message
    });
  }
});

app.post('/review', async (req: Request, res: Response) => {
  const parsed = ReviewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const { query, peer_answers: peerAnswers, options } = parsed.data;
  const prompt = buildReviewPrompt(query, peerAnswers);
  const reviewSystemPrompt = buildReviewSystemPrompt(roleProfile);
  const promptText = `${reviewSystemPrompt}\n\n${prompt}`;
  const start = Date.now();

  let rawText = '';
  try {
    const messages: OllamaMessage[] = [
      { role: 'system', content: reviewSystemPrompt },
      { role: 'user', content: prompt }
    ];

    rawText = await client.chat(messages, {
      temperature: options?.temperature ?? 0.2,
      num_predict: 384,
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
      console.error('Review JSON parse failed; raw output:', rawText);
      const fallback = buildFallbackReview(peerAnswers, start, token_usage);
      console.warn('Using fallback review output due to invalid JSON.');
      const fallbackParsed = ReviewResponseSchema.safeParse(fallback);
      if (!fallbackParsed.success) {
        return res.status(500).json({ error: 'Response validation failed' });
      }
      return res.json(fallbackParsed.data);
    }
    try {
      parsedOutput = JSON.parse(extracted);
    } catch {
      console.error('Review JSON extraction failed; raw output:', rawText);
      const fallback = buildFallbackReview(peerAnswers, start, token_usage);
      console.warn('Using fallback review output due to invalid JSON.');
      const fallbackParsed = ReviewResponseSchema.safeParse(fallback);
      if (!fallbackParsed.success) {
        return res.status(500).json({ error: 'Response validation failed' });
      }
      return res.json(fallbackParsed.data);
    }
  }

  const normalizedOutput =
    parsedOutput && typeof parsedOutput === 'object'
      ? { ...(parsedOutput as Record<string, unknown>) }
      : parsedOutput;

  if (normalizedOutput && typeof normalizedOutput === 'object') {
    const rankings = (normalizedOutput as { rankings?: unknown }).rankings;
    if (
      Array.isArray(rankings) &&
      rankings.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          'anon_id' in item &&
          typeof (item as { anon_id: unknown }).anon_id === 'string'
      )
    ) {
      (normalizedOutput as { rankings: string[] }).rankings = rankings.map(
        (item) => (item as { anon_id: string }).anon_id
      );
    }
  }

  const reviewParsed = ReviewModelOutputSchema.safeParse(normalizedOutput);
  if (!reviewParsed.success) {
    console.error('Review output validation failed:', reviewParsed.error.issues, 'Raw output:', rawText);
    const fallback = buildFallbackReview(peerAnswers, start, token_usage);
    console.warn('Using fallback review output due to invalid review format.');
    const fallbackParsed = ReviewResponseSchema.safeParse(fallback);
    if (!fallbackParsed.success) {
      return res.status(500).json({ error: 'Response validation failed' });
    }
    return res.json(fallbackParsed.data);
  }

  const responseBody = {
    member_id: memberId,
    rankings: reviewParsed.data.rankings,
    critiques: reviewParsed.data.critiques,
    confidence: reviewParsed.data.confidence,
    latency_ms: Date.now() - start,
    token_usage
  };
  const responseParsed = ReviewResponseSchema.safeParse(responseBody);
  if (!responseParsed.success) {
    console.error('Review response validation failed:', responseParsed.error);
    return res.status(500).json({ error: 'Response validation failed' });
  }

  return res.json(responseParsed.data);
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Council member service listening on port ${port}`);
});
