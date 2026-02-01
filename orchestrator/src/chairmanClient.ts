export interface ChairmanHealthResponse {
  ok: boolean;
  chairman_id?: string;
  model_name?: string;
  ollama_base_url?: string;
  timestamp?: string;
  error?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChairmanSynthesizeRequest {
  request_id: string;
  query: string;
  answers: Array<{ anon_id: string; answer_text: string }>;
  reviews: Array<{
    reviewer_anon?: string;
    rankings?: string[];
    critiques?: Record<string, string>;
    confidence?: number;
  }>;
  aggregated_ranking: Array<{ anon_id: string; score: number }>;
  options?: {
    temperature?: number;
  };
}

export interface ChairmanSynthesizeResponse {
  chairman_id: string;
  final_answer: string;
  rationale: string;
  used_signals: {
    top_ranked: string[];
    disagreements: string[];
    notes: string[];
  };
  latency_ms: number;
  token_usage?: TokenUsage;
}

async function requestJson<T>(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      const detail = bodyText ? `: ${bodyText}` : '';
      throw new Error(`Request failed with ${response.status} ${response.statusText}${detail}`);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function chairmanHealth(
  chairmanUrl: string,
  timeoutMs: number
): Promise<ChairmanHealthResponse> {
  const url = `${normalizeUrl(chairmanUrl)}/health`;
  return requestJson<ChairmanHealthResponse>(url, { method: 'GET' }, timeoutMs);
}

export async function synthesize(
  chairmanUrl: string,
  payload: ChairmanSynthesizeRequest,
  timeoutMs: number
): Promise<ChairmanSynthesizeResponse> {
  const url = `${normalizeUrl(chairmanUrl)}/synthesize`;
  return requestJson<ChairmanSynthesizeResponse>(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    },
    timeoutMs
  );
}
