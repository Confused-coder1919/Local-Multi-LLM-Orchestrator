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

export const SynthesizeRequestSchema = z.object({
  request_id: z.string().min(1),
  query: z.string().min(1),
  answers: z
    .array(
      z.object({
        anon_id: z.string().min(1),
        answer_text: z.string().min(1)
      })
    )
    .min(1),
  reviews: z
    .array(
      z.object({
        reviewer_anon: z.string().optional(),
        rankings: z.array(z.string()).optional(),
        critiques: z.record(z.string()).optional(),
        confidence: z.number().min(0).max(1).optional()
      })
    )
    .default([]),
  aggregated_ranking: z
    .array(
      z.object({
        anon_id: z.string().min(1),
        score: z.number()
      })
    )
    .min(1),
  options: OptionsSchema
});

export const SynthesizeResponseSchema = z.object({
  chairman_id: z.string().min(1),
  final_answer: z.string().min(1),
  rationale: z.string().min(1),
  used_signals: z.object({
    top_ranked: z.array(z.string()),
    disagreements: z.array(z.string()),
    notes: z.array(z.string())
  }),
  latency_ms: z.number().int().nonnegative(),
  token_usage: TokenUsageSchema.optional()
});

export type SynthesizeRequest = z.infer<typeof SynthesizeRequestSchema>;
export type SynthesizeResponse = z.infer<typeof SynthesizeResponseSchema>;
