import express, { type NextFunction, type Request, type Response } from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { answer, health, review } from './councilClient';
import { chairmanHealth, synthesize } from './chairmanClient';
import {
  Stage1RequestSchema,
  Stage1ResponseSchema,
  Stage2RequestSchema,
  Stage2ResponseSchema,
  Stage3RequestSchema,
  Stage3ResponseSchema
} from './schemas';
import { anonymizeAnswers, peerAnswersFor, type AnonymizedAnswer } from './anonymize';
import { aggregateRankings } from './aggregate';
import {
  cacheRequestState,
  createRequestState,
  deleteRequestState,
  getRequestState,
  listPersistedRuns,
  loadRequestStateFromPersistence,
  persistRequestState,
  type RequestState,
  type Stage3State
} from './store';
import { startHeartbeatMonitor } from './heartbeat';

dotenv.config();

const portValue = Number.parseInt(process.env.PORT ?? '', 10);
const port = Number.isNaN(portValue) ? 9000 : portValue;
const membersEnv = process.env.COUNCIL_MEMBERS ?? '';
const timeoutValue = Number.parseInt(process.env.ORCH_TIMEOUT_MS ?? '', 10);
const timeoutMs = Number.isNaN(timeoutValue) ? 60000 : timeoutValue;
const chairmanUrl = process.env.CHAIRMAN_URL || 'http://localhost:9100';
const heartbeatIntervalValue = Number.parseInt(
  process.env.HEARTBEAT_INTERVAL_MS ?? '',
  10
);
const heartbeatIntervalMs = Number.isNaN(heartbeatIntervalValue)
  ? 15000
  : Math.max(heartbeatIntervalValue, 1000);
const heartbeatTimeoutValue = Number.parseInt(
  process.env.HEARTBEAT_TIMEOUT_MS ?? '',
  10
);
const heartbeatTimeoutMs = Number.isNaN(heartbeatTimeoutValue)
  ? 5000
  : Math.max(heartbeatTimeoutValue, 1000);
const corsOriginsEnv = process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174';
const corsOrigins = corsOriginsEnv
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const memberUrls = membersEnv
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

if (memberUrls.length === 0) {
  console.error('COUNCIL_MEMBERS is required and must include at least one URL.');
  process.exit(1);
}

const heartbeatMonitor = startHeartbeatMonitor({
  memberUrls,
  chairmanUrl,
  intervalMs: heartbeatIntervalMs,
  timeoutMs: heartbeatTimeoutMs
});

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    const allowed =
      corsOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(err);
});

function buildAnswersList(state: RequestState): AnonymizedAnswer[] {
  const answersList: AnonymizedAnswer[] = [];
  for (const [anon_id, member_url] of Object.entries(state.stage1.anon_map)) {
    const stored = state.stage1.answers_by_url[member_url];
    if (stored && 'answer_text' in stored) {
      answersList.push({
        anon_id,
        answer_text: stored.answer_text,
        member_url
      });
    }
  }
  return answersList;
}

function buildReviewsForChairman(state: RequestState): Array<{
  reviewer_anon?: string;
  rankings?: string[];
  critiques?: Record<string, string>;
  confidence?: number;
}> {
  const reviewerAnonByUrl = new Map(
    Object.entries(state.stage1.anon_map).map(([anonId, url]) => [url, anonId])
  );
  const reviews: Array<{
    reviewer_anon?: string;
    rankings?: string[];
    critiques?: Record<string, string>;
    confidence?: number;
  }> = [];

  for (const [reviewer_url, reviewValue] of Object.entries(state.stage2.reviews_by_url)) {
    if (!reviewValue || typeof reviewValue !== 'object') {
      continue;
    }
    const review = reviewValue as {
      status?: string;
      rankings?: string[];
      critiques?: Record<string, string>;
      confidence?: number;
    };
    if (review.status !== 'ok') {
      continue;
    }

    const entry: {
      reviewer_anon?: string;
      rankings?: string[];
      critiques?: Record<string, string>;
      confidence?: number;
    } = {
      rankings: review.rankings,
      critiques: review.critiques,
      confidence: review.confidence
    };
    const reviewerAnon = reviewerAnonByUrl.get(reviewer_url);
    if (reviewerAnon) {
      entry.reviewer_anon = reviewerAnon;
    }
    reviews.push(entry);
  }

  return reviews;
}

function buildStage1Summary(state: RequestState) {
  const anonByMemberUrl = new Map(
    Object.entries(state.stage1.anon_map).map(([anonId, url]) => [url, anonId])
  );
  const memberOrder =
    memberUrls.length > 0 ? memberUrls : Object.keys(state.stage1.answers_by_url);
  const answers = [];

  for (const member_url of memberOrder) {
    const stored = state.stage1.answers_by_url[member_url];
    if (!stored) {
      continue;
    }
    const anon_id = anonByMemberUrl.get(member_url) ?? '';

    if ('answer_text' in stored) {
      answers.push({
        anon_id,
        answer_text: stored.answer_text,
        member_url,
        latency_ms: stored.latency_ms,
        token_usage: stored.token_usage,
        status: 'ok' as const
      });
    } else {
      answers.push({
        anon_id,
        answer_text: '',
        member_url,
        status: 'error' as const,
        error: stored.error
      });
    }
  }

  return { answers };
}

function buildStage2Summary(state: RequestState) {
  const reviews = Object.entries(state.stage2.reviews_by_url).map(
    ([reviewer_url, value]) => {
      if (!value || typeof value !== 'object') {
        return {
          reviewer_url,
          status: 'error' as const,
          error: 'Missing review payload'
        };
      }

      const review = value as {
        status?: string;
        rankings?: string[];
        critiques?: Record<string, string>;
        confidence?: number;
        latency_ms?: number;
        token_usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        error?: string;
      };

      if (review.status === 'ok') {
        return {
          reviewer_url,
          status: 'ok' as const,
          rankings: review.rankings,
          critiques: review.critiques,
          confidence: review.confidence,
          latency_ms: review.latency_ms,
          token_usage: review.token_usage
        };
      }

      return {
        reviewer_url,
        status: 'error' as const,
        error: review.error ?? 'Review failed'
      };
    }
  );

  return {
    reviews,
    aggregated_ranking: state.stage2.aggregated_ranking ?? []
  };
}

function buildStage3Summary(state: RequestState) {
  if (!state.stage3) {
    return { status: 'pending' as const };
  }

  if (state.stage3.status === 'ok') {
    return {
      status: 'ok' as const,
      final_answer: state.stage3.final_answer,
      rationale: state.stage3.rationale,
      used_signals: state.stage3.used_signals,
      latency_ms: state.stage3.latency_ms,
      token_usage: state.stage3.token_usage
    };
  }

  return {
    status: 'error' as const,
    error: state.stage3.error
  };
}

function buildRequestResponse(state: RequestState) {
  return {
    request_id: state.request_id,
    query: state.query,
    created_at: state.created_at,
    stage1: buildStage1Summary(state),
    stage2: buildStage2Summary(state),
    stage3: buildStage3Summary(state)
  };
}

app.get('/health', async (_req: Request, res: Response) => {
  const checks = await Promise.all(
    memberUrls.map(async (member_url) => {
      try {
        const data = await health(member_url, timeoutMs);
        return { member_url, status: 'ok' as const, data };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { member_url, status: 'error' as const, error: message };
      }
    })
  );

  const chairmanCheck = await (async () => {
    try {
      const data = await chairmanHealth(chairmanUrl, timeoutMs);
      return { chairman_url: chairmanUrl, status: 'ok' as const, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { chairman_url: chairmanUrl, status: 'error' as const, error: message };
    }
  })();

  const ok = checks.every((check) => check.status === 'ok') && chairmanCheck.status === 'ok';
  return res.json({
    ok,
    members: checks,
    chairman: chairmanCheck,
    timestamp: new Date().toISOString(),
    heartbeat: heartbeatMonitor.getSnapshot()
  });
});

app.get('/heartbeat', (_req: Request, res: Response) => {
  return res.json(heartbeatMonitor.getSnapshot());
});

app.post('/stage1', async (req: Request, res: Response) => {
  const parsed = Stage1RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const { query, options } = parsed.data;
  const request_id = randomUUID();
  const state = createRequestState(request_id, query);

  const results = await Promise.all(
    memberUrls.map(async (member_url) => {
      const start = Date.now();
      try {
        const data = await answer(
          member_url,
          { request_id, query, options },
          timeoutMs
        );
        const latency_ms = Number.isFinite(data.latency_ms)
          ? data.latency_ms
          : Date.now() - start;
        return {
          member_url,
          status: 'ok' as const,
          answer_text: data.answer_text,
          latency_ms,
          token_usage: data.token_usage
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          member_url,
          status: 'error' as const,
          error: message
        };
      }
    })
  );

  const successAnswers = results
    .filter((result) => result.status === 'ok')
    .map((result) => ({
      member_url: result.member_url,
      answer_text: result.answer_text
    }));

  const anonymized = anonymizeAnswers(successAnswers);
  state.stage1.anon_map = anonymized.anon_map;

  for (const result of results) {
    if (result.status === 'ok') {
      state.stage1.answers_by_url[result.member_url] = {
        answer_text: result.answer_text,
        latency_ms: result.latency_ms,
        token_usage: result.token_usage
      };
    } else {
      state.stage1.answers_by_url[result.member_url] = {
        error: result.error
      };
    }
  }

  const anonByMemberUrl = new Map(
    anonymized.answers_list.map((answer) => [answer.member_url, answer.anon_id])
  );

  const responseAnswers = results.map((result) => {
    if (result.status === 'ok') {
      return {
        anon_id: anonByMemberUrl.get(result.member_url) ?? '',
        answer_text: result.answer_text,
        member_url: result.member_url,
        latency_ms: result.latency_ms,
        token_usage: result.token_usage,
        status: 'ok' as const
      };
    }

    return {
      anon_id: '',
      answer_text: '',
      member_url: result.member_url,
      status: 'error' as const,
      error: result.error
    };
  });

  const responseBody = {
    request_id,
    query,
    answers: responseAnswers
  };

  persistRequestState(state);

  const responseParsed = Stage1ResponseSchema.safeParse(responseBody);
  if (!responseParsed.success) {
    console.error('Stage1 response validation failed:', responseParsed.error);
    return res.status(500).json({ error: 'Response validation failed' });
  }

  return res.json(responseParsed.data);
});

app.post('/stage2', async (req: Request, res: Response) => {
  const parsed = Stage2RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const { request_id, options } = parsed.data;
  const state = getRequestState(request_id);
  if (!state) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const answersList = buildAnswersList(state);
  if (answersList.length < 2) {
    persistRequestState(state);
    return res.status(400).json({ error: 'Not enough answers to run stage2' });
  }

  const reviewResults = await Promise.all(
    answersList.map(async (answerEntry) => {
      const start = Date.now();
      const reviewerUrl = answerEntry.member_url;
      const peer_answers = peerAnswersFor(answersList, reviewerUrl);

      try {
        const data = await review(
          reviewerUrl,
          {
            request_id,
            query: state.query,
            peer_answers,
            options
          },
          timeoutMs
        );

        const latency_ms = Number.isFinite(data.latency_ms)
          ? data.latency_ms
          : Date.now() - start;

        const result = {
          reviewer_url: reviewerUrl,
          status: 'ok' as const,
          rankings: data.rankings,
          critiques: data.critiques,
          confidence: data.confidence,
          latency_ms,
          token_usage: data.token_usage
        };

        state.stage2.reviews_by_url[reviewerUrl] = result;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const result = {
          reviewer_url: reviewerUrl,
          status: 'error' as const,
          error: message
        };
        state.stage2.reviews_by_url[reviewerUrl] = result;
        return result;
      }
    })
  );

  const successfulReviews = reviewResults.filter((result) => result.status === 'ok');
  const aggregated = aggregateRankings(
    successfulReviews.map((review) => ({ rankings: review.rankings })),
    answersList.map((answer) => answer.anon_id)
  );

  state.stage2.aggregated_ranking = aggregated;

  const responseBody = {
    request_id,
    reviews: reviewResults,
    aggregated_ranking: aggregated
  };

  persistRequestState(state);

  const responseParsed = Stage2ResponseSchema.safeParse(responseBody);
  if (!responseParsed.success) {
    console.error('Stage2 response validation failed:', responseParsed.error);
    return res.status(500).json({ error: 'Response validation failed' });
  }

  return res.json(responseParsed.data);
});

app.post('/stage3', async (req: Request, res: Response) => {
  const parsed = Stage3RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.flatten()
    });
  }

  const { request_id, options } = parsed.data;
  const state = getRequestState(request_id);
  if (!state) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const answersList = buildAnswersList(state);
  if (answersList.length < 1) {
    persistRequestState(state);
    return res.status(400).json({ error: 'No answers available for stage3' });
  }

  const aggregatedRanking = state.stage2.aggregated_ranking;
  if (!aggregatedRanking || aggregatedRanking.length === 0) {
    persistRequestState(state);
    return res.status(400).json({ error: 'Stage2 results are required for stage3' });
  }

  const payload = {
    request_id,
    query: state.query,
    answers: answersList.map((answer) => ({
      anon_id: answer.anon_id,
      answer_text: answer.answer_text
    })),
    reviews: buildReviewsForChairman(state),
    aggregated_ranking: aggregatedRanking,
    options
  };

  let stage3State: Stage3State = {
    chairman_url: chairmanUrl,
    status: 'error'
  };
  state.stage3 = stage3State;

  try {
    const data = await synthesize(chairmanUrl, payload, timeoutMs);
    const responseBody = {
      request_id,
      status: 'ok' as const,
      final_answer: data.final_answer,
      rationale: data.rationale,
      used_signals: data.used_signals,
      latency_ms: data.latency_ms,
      token_usage: data.token_usage
    };

    const responseParsed = Stage3ResponseSchema.safeParse(responseBody);
    if (!responseParsed.success) {
      console.error('Stage3 response validation failed:', responseParsed.error);
      stage3State = {
        chairman_url: chairmanUrl,
        status: 'error',
        error: 'Response validation failed'
      };
      state.stage3 = stage3State;
      persistRequestState(state);
      return res.status(500).json({ error: 'Response validation failed' });
    }

    stage3State = {
      chairman_url: chairmanUrl,
      status: 'ok',
      chairman_id: data.chairman_id,
      final_answer: data.final_answer,
      rationale: data.rationale,
      used_signals: data.used_signals,
      latency_ms: data.latency_ms,
      token_usage: data.token_usage
    };
    state.stage3 = stage3State;
    persistRequestState(state);

    return res.json(responseParsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stage3State = {
      chairman_url: chairmanUrl,
      status: 'error',
      error: message
    };
    state.stage3 = stage3State;
    persistRequestState(state);

    const responseBody = {
      request_id,
      status: 'error' as const,
      error: message
    };

    const responseParsed = Stage3ResponseSchema.safeParse(responseBody);
    if (!responseParsed.success) {
      console.error('Stage3 error response validation failed:', responseParsed.error);
      return res.status(500).json({ error: 'Response validation failed' });
    }

    return res.json(responseParsed.data);
  }
});

app.get('/runs', (req: Request, res: Response) => {
  const limitRaw = req.query.limit;
  const limitValue = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isNaN(limitValue) ? 20 : Math.max(limitValue, 1);

  const runs = listPersistedRuns(limit);
  return res.json({ runs });
});

app.get('/runs/:id', (req: Request, res: Response) => {
  const requestId = req.params.id;
  let state = getRequestState(requestId);
  if (!state) {
    const loaded = loadRequestStateFromPersistence(requestId);
    if (loaded) {
      cacheRequestState(loaded);
      state = loaded;
    }
  }

  if (!state) {
    return res.status(404).json({ error: 'Request not found' });
  }

  return res.json(buildRequestResponse(state));
});

app.delete('/runs/:id', (req: Request, res: Response) => {
  const requestId = req.params.id;
  deleteRequestState(requestId);
  return res.json({ ok: true });
});

app.get('/request/:id', (req: Request, res: Response) => {
  const state = getRequestState(req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'Request not found' });
  }

  return res.json(buildRequestResponse(state));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Orchestrator listening on port ${port}`);
});
