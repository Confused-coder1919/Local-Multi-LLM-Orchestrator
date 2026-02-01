import { z } from 'zod';

const StageOptionsSchema = z
  .object({
    temperature: z.number().optional()
  })
  .optional();

const TokenUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative()
});

export const Stage1RequestSchema = z.object({
  query: z.string().min(1),
  options: StageOptionsSchema
});

export const Stage1AnswerSchema = z.object({
  anon_id: z.string(),
  answer_text: z.string(),
  member_url: z.string().url(),
  latency_ms: z.number().int().nonnegative().optional(),
  token_usage: TokenUsageSchema.optional(),
  status: z.enum(['ok', 'error']),
  error: z.string().optional()
});

export const Stage1ResponseSchema = z.object({
  request_id: z.string().min(1),
  query: z.string().min(1),
  answers: z.array(Stage1AnswerSchema)
});

export const Stage2RequestSchema = z.object({
  request_id: z.string().min(1),
  options: StageOptionsSchema
});

export const Stage2ReviewSchema = z.object({
  reviewer_url: z.string().url(),
  status: z.enum(['ok', 'error']),
  rankings: z.array(z.string()).optional(),
  critiques: z.record(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  latency_ms: z.number().int().nonnegative().optional(),
  token_usage: TokenUsageSchema.optional(),
  error: z.string().optional()
});

export const AggregatedRankingSchema = z.object({
  anon_id: z.string(),
  score: z.number()
});

export const Stage2ResponseSchema = z.object({
  request_id: z.string().min(1),
  reviews: z.array(Stage2ReviewSchema),
  aggregated_ranking: z.array(AggregatedRankingSchema)
});

export const Stage3RequestSchema = z.object({
  request_id: z.string().min(1),
  options: StageOptionsSchema
});

export const Stage3ResponseSchema = z.object({
  request_id: z.string().min(1),
  status: z.enum(['ok', 'error']),
  final_answer: z.string().optional(),
  rationale: z.string().optional(),
  used_signals: z.unknown().optional(),
  latency_ms: z.number().int().nonnegative().optional(),
  token_usage: TokenUsageSchema.optional(),
  error: z.string().optional()
});

export type Stage1Request = z.infer<typeof Stage1RequestSchema>;
export type Stage1Response = z.infer<typeof Stage1ResponseSchema>;
export type Stage2Request = z.infer<typeof Stage2RequestSchema>;
export type Stage2Response = z.infer<typeof Stage2ResponseSchema>;
export type Stage3Request = z.infer<typeof Stage3RequestSchema>;
export type Stage3Response = z.infer<typeof Stage3ResponseSchema>;
