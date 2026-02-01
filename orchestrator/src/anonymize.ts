export interface AnonymizedAnswer {
  anon_id: string;
  answer_text: string;
  member_url: string;
}

export interface PeerAnswer {
  anon_id: string;
  answer_text: string;
}

export interface AnonymizeResult {
  answers_list: AnonymizedAnswer[];
  anon_map: Record<string, string>;
  peer_answers_for: (reviewer_url: string) => PeerAnswer[];
}

function indexToAnonId(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index);
  }
  return `A${index + 1}`;
}

export function anonymizeAnswers(
  answers: Array<{ member_url: string; answer_text: string }>
): AnonymizeResult {
  const sorted = [...answers].sort((a, b) => a.member_url.localeCompare(b.member_url));
  const anon_map: Record<string, string> = {};

  const answers_list: AnonymizedAnswer[] = sorted.map((answer, index) => {
    const anon_id = indexToAnonId(index);
    anon_map[anon_id] = answer.member_url;
    return {
      anon_id,
      answer_text: answer.answer_text,
      member_url: answer.member_url
    };
  });

  const peer_answers_for = (reviewer_url: string): PeerAnswer[] =>
    answers_list
      .filter((answer) => answer.member_url !== reviewer_url)
      .map((answer) => ({
        anon_id: answer.anon_id,
        answer_text: answer.answer_text
      }));

  return { answers_list, anon_map, peer_answers_for };
}

export function peerAnswersFor(
  answers_list: AnonymizedAnswer[],
  reviewer_url: string
): PeerAnswer[] {
  return answers_list
    .filter((answer) => answer.member_url !== reviewer_url)
    .map((answer) => ({
      anon_id: answer.anon_id,
      answer_text: answer.answer_text
    }));
}
