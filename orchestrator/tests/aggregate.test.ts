import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRankings } from '../src/aggregate';

test('aggregateRankings dedupes rankings and ignores unknown ids', () => {
  const reviews = [{ rankings: ['A', 'A', 'B', 'X', 'B'] }];
  const result = aggregateRankings(reviews, ['A', 'B']);

  assert.deepStrictEqual(result, [
    { anon_id: 'A', score: 2 },
    { anon_id: 'B', score: 1 }
  ]);
});

test('aggregateRankings keeps deterministic order on ties', () => {
  const reviews: Array<{ rankings?: string[] }> = [];
  const result = aggregateRankings(reviews, ['B', 'A']);

  assert.deepStrictEqual(result, [
    { anon_id: 'A', score: 0 },
    { anon_id: 'B', score: 0 }
  ]);
});
