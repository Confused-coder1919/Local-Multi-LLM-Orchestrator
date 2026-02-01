export interface ReviewRankingInput {
  rankings?: string[];
}

export interface AggregatedScore {
  anon_id: string;
  score: number;
}

export function aggregateRankings(
  reviews: ReviewRankingInput[],
  knownAnonIds: string[]
): AggregatedScore[] {
  const scores: Record<string, number> = {};
  for (const anon_id of knownAnonIds) {
    scores[anon_id] = 0;
  }

  for (const review of reviews) {
    if (!review.rankings || review.rankings.length === 0) {
      continue;
    }

    const filtered = review.rankings.filter((anon_id) => anon_id in scores);
    const total = filtered.length;
    filtered.forEach((anon_id, index) => {
      scores[anon_id] += total - index;
    });
  }

  return Object.entries(scores)
    .map(([anon_id, score]) => ({ anon_id, score }))
    .sort((a, b) => b.score - a.score || a.anon_id.localeCompare(b.anon_id));
}
