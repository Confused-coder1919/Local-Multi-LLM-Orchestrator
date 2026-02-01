import { z } from 'zod';

const OptionsSchema = z
  .object({
    temperature: z.number().optional()
  })
  .optional();

const TokenUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative()
});

export const AnswerRequestSchema = z.object({
  request_id: z.string().min(1),
  query: z.string().min(1),
  options: OptionsSchema
});

export const AnswerResponseSchema = z.object({
  member_id: z.string().min(1),
  answer_text: z.string(),
  latency_ms: z.number().int().nonnegative(),
  token_usage: TokenUsageSchema.optional()
});

export const ReviewRequestSchema = z.object({
  request_id: z.string().min(1),
  query: z.string().min(1),
  peer_answers: z
    .array(
      z.object({
        anon_id: z.string().min(1),
        answer_text: z.string().min(1)
      })
    )
    .min(1),
  options: OptionsSchema
});

export const ReviewResponseSchema = z.object({
  member_id: z.string().min(1),
  rankings: z.array(z.string()),
  critiques: z.record(z.string()),
  confidence: z.number().min(0).max(1),
  latency_ms: z.number().int().nonnegative(),
  token_usage: TokenUsageSchema.optional()
});

export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>;
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
