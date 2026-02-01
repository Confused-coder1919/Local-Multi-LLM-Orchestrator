const ORCH_URL = import.meta.env.VITE_ORCH_URL || 'http://localhost:9000';

export interface StageOptions {
  temperature?: number;
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface HeartbeatStatus {
  status: 'ok' | 'error' | 'unknown';
  last_checked_at?: string;
  last_ok_at?: string;
  last_error_at?: string;
  last_latency_ms?: number;
  consecutive_failures: number;
  last_error?: string;
  last_response?: JsonValue;
}

export interface HeartbeatSnapshot {
  interval_ms: number;
  timeout_ms: number;
  updated_at: string;
  members: Record<string, HeartbeatStatus>;
  chairman: { url: string; status: HeartbeatStatus };
}

export interface HealthResponse {
  ok: boolean;
  members: Array<{ member_url: string; status: 'ok' | 'error'; data?: JsonObject; error?: string }>;
  chairman: { chairman_url: string; status: 'ok' | 'error'; data?: JsonObject; error?: string };
  timestamp: string;
  heartbeat?: HeartbeatSnapshot;
}

export interface Stage1Answer {
  anon_id: string;
  answer_text: string;
  member_url: string;
  latency_ms?: number;
  token_usage?: TokenUsage;
  status: 'ok' | 'error';
  error?: string;
}

export interface Stage1Response {
  request_id: string;
  query: string;
  answers: Stage1Answer[];
}

export interface Stage2Review {
  reviewer_url: string;
  status: 'ok' | 'error';
  rankings?: string[];
  critiques?: Record<string, string>;
  confidence?: number;
  latency_ms?: number;
  token_usage?: TokenUsage;
  error?: string;
}

export interface AggregatedRankingEntry {
  anon_id: string;
  score: number;
}

export interface Stage2Response {
  request_id: string;
  reviews: Stage2Review[];
  aggregated_ranking: AggregatedRankingEntry[];
}

export interface Stage3Response {
  request_id: string;
  status: 'ok' | 'error';
  final_answer?: string;
  rationale?: string;
  used_signals?: JsonValue;
  latency_ms?: number;
  token_usage?: TokenUsage;
  error?: string;
}

export interface RequestStateResponse {
  request_id: string;
  query: string;
  created_at?: string;
  stage1: {
    answers: Stage1Answer[];
  };
  stage2: {
    reviews: Stage2Review[];
    aggregated_ranking: AggregatedRankingEntry[];
  };
  stage3: {
    status: 'ok' | 'error' | 'pending';
    final_answer?: string;
    rationale?: string;
    used_signals?: JsonValue;
    latency_ms?: number;
    token_usage?: TokenUsage;
    error?: string;
  };
}

export interface RunSummary {
  request_id: string;
  created_at: string;
  query: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ORCH_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const message = data?.error || res.statusText;
    throw new Error(message);
  }

  return data as T;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export async function fetchRuns(limit = 20): Promise<RunSummary[]> {
  const res = await request<{ runs: RunSummary[] }>(`/runs?limit=${limit}`);
  return res.runs;
}

export async function fetchRunById(request_id: string): Promise<RequestStateResponse> {
  return request<RequestStateResponse>(`/runs/${request_id}`);
}

export async function deleteRunById(request_id: string): Promise<void> {
  await request<{ ok: boolean }>(`/runs/${request_id}`, { method: 'DELETE' });
}

export async function stage1(query: string, options?: StageOptions): Promise<Stage1Response> {
  return request<Stage1Response>('/stage1', {
    method: 'POST',
    body: JSON.stringify({ query, options })
  });
}

export async function stage2(
  request_id: string,
  options?: StageOptions
): Promise<Stage2Response> {
  return request<Stage2Response>('/stage2', {
    method: 'POST',
    body: JSON.stringify({ request_id, options })
  });
}

export async function stage3(
  request_id: string,
  options?: StageOptions
): Promise<Stage3Response> {
  return request<Stage3Response>('/stage3', {
    method: 'POST',
    body: JSON.stringify({ request_id, options })
  });
}

export async function getRequest(request_id: string): Promise<RequestStateResponse> {
  return request<RequestStateResponse>(`/request/${request_id}`);
}

export function getOrchestratorUrl(): string {
  return ORCH_URL;
}
