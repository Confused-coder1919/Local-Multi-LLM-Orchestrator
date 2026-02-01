import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeAnswers, peerAnswersFor } from '../src/anonymize';

test('anonymizeAnswers sorts by member_url and assigns stable anon ids', () => {
  const result = anonymizeAnswers([
    { member_url: 'http://b.local:8002', answer_text: 'B answer' },
    { member_url: 'http://a.local:8001', answer_text: 'A answer' }
  ]);

  assert.deepStrictEqual(result.answers_list, [
    { anon_id: 'A', answer_text: 'A answer', member_url: 'http://a.local:8001' },
    { anon_id: 'B', answer_text: 'B answer', member_url: 'http://b.local:8002' }
  ]);
  assert.deepStrictEqual(result.anon_map, {
    A: 'http://a.local:8001',
    B: 'http://b.local:8002'
  });
  assert.deepStrictEqual(result.peer_answers_for('http://a.local:8001'), [
    { anon_id: 'B', answer_text: 'B answer' }
  ]);
});

test('peerAnswersFor excludes reviewer and keeps anon ids', () => {
  const answers = [
    { anon_id: 'A', answer_text: 'A', member_url: 'http://a' },
    { anon_id: 'B', answer_text: 'B', member_url: 'http://b' }
  ];

  assert.deepStrictEqual(peerAnswersFor(answers, 'http://b'), [
    { anon_id: 'A', answer_text: 'A' }
  ]);
});
