export const ANSWER_SYSTEM_PROMPT = 'Provide the best possible answer. Be accurate and concise.';

export const REVIEW_SYSTEM_PROMPT =
  'You are a strict evaluator. Return JSON only. No markdown, no extra text.';

function withRoleProfile(basePrompt: string, roleProfile?: string): string {
  const trimmed = roleProfile?.trim();
  if (!trimmed) {
    return basePrompt;
  }
  return `${basePrompt}\nRole profile: ${trimmed}.`;
}

export function buildAnswerSystemPrompt(roleProfile?: string): string {
  return withRoleProfile(ANSWER_SYSTEM_PROMPT, roleProfile);
}

export function buildReviewSystemPrompt(roleProfile?: string): string {
  return withRoleProfile(REVIEW_SYSTEM_PROMPT, roleProfile);
}
