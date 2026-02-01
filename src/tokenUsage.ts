export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Heuristic for rough estimation; not model- or tokenizer-exact.
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return Math.max(1, Math.ceil(trimmed.length / CHARS_PER_TOKEN));
}

export function estimateTokenUsage(promptText: string, completionText: string): TokenUsage {
  const prompt_tokens = estimateTokens(promptText);
  const completion_tokens = estimateTokens(completionText);
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens
  };
}
