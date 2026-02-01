import dotenv from 'dotenv';
import {
  deleteRun,
  initDb,
  listRuns,
  loadRun,
  saveRun
} from './persistence';

dotenv.config();

export type Stage3State =
  | { chairman_url: string; status: 'error'; error?: string }
  | {
      chairman_url: string;
      status: 'ok';
      chairman_id: string;
      final_answer: string;
      rationale: string;
      used_signals: unknown;
      latency_ms: number;
      token_usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

export interface RequestState {
  request_id: string;
  query: string;
  created_at: string;
  stage1: {
    answers_by_url: Record<
      string,
      | { answer_text: string; latency_ms?: number; token_usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
      | { error: string }
    >;
    anon_map: Record<string, string>;
  };
  stage2: {
    reviews_by_url: Record<string, unknown>;
    aggregated_ranking?: Array<{ anon_id: string; score: number }>;
  };
  stage3?: Stage3State;
}

const requestStore = new Map<string, RequestState>();

const persistenceEnabled = (process.env.PERSISTENCE_ENABLED ?? 'true').toLowerCase() === 'true';
const persistenceDbPath = process.env.PERSISTENCE_DB ?? './data/orchestrator.db';
const bootstrapLimitValue = Number.parseInt(
  process.env.PERSISTENCE_BOOTSTRAP_LIMIT ?? '',
  10
);
const persistenceBootstrapLimit = Number.isNaN(bootstrapLimitValue)
  ? 20
  : bootstrapLimitValue;

let persistenceReady = false;

if (persistenceEnabled) {
  try {
    initDb(persistenceDbPath);
    persistenceReady = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Persistence disabled: ${message}`);
  }
}

if (persistenceReady) {
  try {
    const recent = listRuns(persistenceBootstrapLimit);
    for (const run of recent) {
      const state = loadRun(run.request_id);
      if (state) {
        requestStore.set(state.request_id, state);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to bootstrap runs: ${message}`);
  }
}

export function createRequestState(request_id: string, query: string): RequestState {
  const state: RequestState = {
    request_id,
    query,
    created_at: new Date().toISOString(),
    stage1: {
      answers_by_url: {},
      anon_map: {}
    },
    stage2: {
      reviews_by_url: {}
    }
  };

  requestStore.set(request_id, state);
  persistRequestState(state);
  return state;
}

export function getRequestState(request_id: string): RequestState | undefined {
  return requestStore.get(request_id);
}

export function listRequestIds(): string[] {
  return Array.from(requestStore.keys());
}

export function cacheRequestState(state: RequestState): void {
  requestStore.set(state.request_id, state);
}

export function persistRequestState(state: RequestState): void {
  if (!persistenceReady) {
    return;
  }

  try {
    saveRun(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to persist run ${state.request_id}: ${message}`);
  }
}

export function loadRequestStateFromPersistence(
  request_id: string
): RequestState | null {
  if (!persistenceReady) {
    return null;
  }

  try {
    return loadRun(request_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to load run ${request_id}: ${message}`);
    return null;
  }
}

export function listPersistedRuns(limit = 20) {
  if (!persistenceReady) {
    return [];
  }

  try {
    return listRuns(limit);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to list runs: ${message}`);
    return [];
  }
}

export function deleteRequestState(request_id: string): void {
  requestStore.delete(request_id);
  if (!persistenceReady) {
    return;
  }
  try {
    deleteRun(request_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to delete run ${request_id}: ${message}`);
  }
}

export function isPersistenceEnabled(): boolean {
  return persistenceReady;
}
