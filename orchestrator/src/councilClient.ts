export interface CouncilHealthResponse {
  ok: boolean;
  member_id?: string;
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

export interface CouncilAnswerRequest {
  request_id: string;
  query: string;
  options?: {
    temperature?: number;
  };
}

export interface CouncilAnswerResponse {
  member_id: string;
  answer_text: string;
  latency_ms: number;
  token_usage?: TokenUsage;
}

export interface CouncilReviewRequest {
  request_id: string;
  query: string;
  peer_answers: Array<{ anon_id: string; answer_text: string }>;
  options?: {
    temperature?: number;
  };
}

export interface CouncilReviewResponse {
  member_id: string;
  rankings: string[];
  critiques: Record<string, string>;
  confidence: number;
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

function normalizeMemberUrl(memberUrl: string): string {
  return memberUrl.replace(/\/+$/, '');
}

export async function health(memberUrl: string, timeoutMs: number): Promise<CouncilHealthResponse> {
  const url = `${normalizeMemberUrl(memberUrl)}/health`;
  return requestJson<CouncilHealthResponse>(url, { method: 'GET' }, timeoutMs);
}

export async function answer(
  memberUrl: string,
  payload: CouncilAnswerRequest,
  timeoutMs: number
): Promise<CouncilAnswerResponse> {
  const url = `${normalizeMemberUrl(memberUrl)}/answer`;
  return requestJson<CouncilAnswerResponse>(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    },
    timeoutMs
  );
}

export async function review(
  memberUrl: string,
  payload: CouncilReviewRequest,
  timeoutMs: number
): Promise<CouncilReviewResponse> {
  const url = `${normalizeMemberUrl(memberUrl)}/review`;
  return requestJson<CouncilReviewResponse>(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    },
    timeoutMs
  );
}
