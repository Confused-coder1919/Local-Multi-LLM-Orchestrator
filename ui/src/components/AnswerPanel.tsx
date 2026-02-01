import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Stage1Answer } from '../api';
import CollapsibleCard from './CollapsibleCard';
import Tabs, { type TabItem } from './Tabs';

interface AnswerPanelProps {
  answers: Stage1Answer[];
  showDebug: boolean;
}

type DiffSegment = { value: string; added: boolean };

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token !== '');
}

function diffTokens(baseText: string, targetText: string): DiffSegment[] {
  const base = tokenize(baseText);
  const target = tokenize(targetText);
  const baseLen = base.length;
  const targetLen = target.length;

  if (!baseLen || !targetLen) {
    return target.map((value) => ({ value, added: true }));
  }

  const dp: number[][] = Array.from({ length: baseLen + 1 }, () =>
    new Array(targetLen + 1).fill(0)
  );

  for (let i = 1; i <= baseLen; i += 1) {
    for (let j = 1; j <= targetLen; j += 1) {
      if (base[i - 1] === target[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const segments: DiffSegment[] = [];
  let i = baseLen;
  let j = targetLen;

  while (i > 0 && j > 0) {
    if (base[i - 1] === target[j - 1]) {
      segments.push({ value: target[j - 1], added: false });
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      segments.push({ value: target[j - 1], added: true });
      j -= 1;
    }
  }

  while (j > 0) {
    segments.push({ value: target[j - 1], added: true });
    j -= 1;
  }

  segments.reverse();

  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && last.added === segment.added) {
      last.value += segment.value;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}

function renderDiffText(baseText: string, targetText: string, highlight: boolean): ReactNode {
  if (!highlight || !baseText.trim()) {
    return targetText;
  }

  const segments = diffTokens(baseText, targetText);
  return segments.map((segment, index) =>
    segment.added ? (
      <mark key={`diff-${index}`} className="diff-add">
        {segment.value}
      </mark>
    ) : (
      <span key={`diff-${index}`}>{segment.value}</span>
    )
  );
}

function getAnswerId(answer: Stage1Answer): string {
  return answer.anon_id || answer.member_url;
}

export default function AnswerPanel({ answers, showDebug }: AnswerPanelProps) {
  const [viewMode, setViewMode] = useState<'tabs' | 'compare'>('tabs');
  const [showDiff, setShowDiff] = useState(true);
  const [baselineId, setBaselineId] = useState('');

  const okAnswers = useMemo(
    () => answers.filter((answer) => answer.status === 'ok' && answer.answer_text.trim()),
    [answers]
  );
  const canCompare = answers.length > 1;

  useEffect(() => {
    if (!okAnswers.length) {
      if (baselineId) {
        setBaselineId('');
      }
      return;
    }
    if (!baselineId || !okAnswers.some((answer) => getAnswerId(answer) === baselineId)) {
      setBaselineId(getAnswerId(okAnswers[0]));
    }
  }, [baselineId, okAnswers]);

  useEffect(() => {
    if (!canCompare && viewMode === 'compare') {
      setViewMode('tabs');
    }
  }, [canCompare, viewMode]);

  const baselineAnswer = okAnswers.find((answer) => getAnswerId(answer) === baselineId);
  const baselineText = baselineAnswer?.answer_text ?? '';

  const items: TabItem[] = answers.map((answer) => {
    const answerId = getAnswerId(answer);
    return {
      id: answerId,
      label: answer.anon_id || 'Unknown',
      status: answer.status,
      content: (
        <div className={`answer-panel ${answer.status}`}>
          <div className="answer-meta">
            <span className={`status-pill ${answer.status}`}>
              {answer.status === 'ok' ? 'ok' : 'error'}
            </span>
            {answer.latency_ms !== undefined ? (
              <span className="muted">Latency: {answer.latency_ms} ms</span>
            ) : null}
          </div>
          {showDebug ? <div className="mono muted">{answer.member_url}</div> : null}
          {answer.status === 'ok' ? (
            <p className="answer-text">{answer.answer_text}</p>
          ) : (
            <div className="banner banner-error">{answer.error || 'Answer failed'}</div>
          )}
        </div>
      )
    };
  });

  return (
    <CollapsibleCard title="Stage 1: Council Answers">
      {!answers.length ? (
        <div className="muted">No answers yet.</div>
      ) : (
        <>
          <div className="panel-toolbar">
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-button ${viewMode === 'tabs' ? 'active' : ''}`}
                onClick={() => setViewMode('tabs')}
              >
                Tab view
              </button>
              <button
                type="button"
                className={`toggle-button ${viewMode === 'compare' ? 'active' : ''}`}
                onClick={() => setViewMode('compare')}
                disabled={!canCompare}
              >
                Compare
              </button>
            </div>
            {viewMode === 'compare' ? (
              <div className="compare-controls">
                <label className="label" htmlFor="baseline-select">
                  Baseline
                </label>
                <select
                  id="baseline-select"
                  value={baselineId}
                  onChange={(event) => setBaselineId(event.target.value)}
                  disabled={!okAnswers.length}
                >
                  {!okAnswers.length ? (
                    <option value="">No baseline</option>
                  ) : (
                    okAnswers.map((answer) => {
                      const answerId = getAnswerId(answer);
                      return (
                        <option key={answerId} value={answerId}>
                          {answer.anon_id || answerId}
                        </option>
                      );
                    })
                  )}
                </select>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showDiff}
                    onChange={(event) => setShowDiff(event.target.checked)}
                    disabled={!baselineText}
                  />
                  <span>Highlight diffs</span>
                </label>
              </div>
            ) : null}
          </div>
          {viewMode === 'tabs' ? (
            <Tabs items={items} />
          ) : (
            <>
              <div className="compare-grid">
                {answers.map((answer) => {
                  const answerId = getAnswerId(answer);
                  const isBaseline = baselineAnswer
                    ? getAnswerId(baselineAnswer) === answerId
                    : false;
                  return (
                    <div
                      key={answerId}
                      className={`compare-card ${answer.status} ${
                        isBaseline ? 'is-baseline' : ''
                      }`}
                    >
                      <div className="compare-header">
                        <div>
                          <div className="label">Anon ID</div>
                          <div className="mono">{answer.anon_id || 'Unknown'}</div>
                        </div>
                        <div className="compare-badges">
                          {isBaseline ? (
                            <span className="status-pill baseline">baseline</span>
                          ) : null}
                          <span className={`status-pill ${answer.status}`}>{answer.status}</span>
                        </div>
                      </div>
                      {answer.latency_ms !== undefined ? (
                        <div className="muted">Latency: {answer.latency_ms} ms</div>
                      ) : null}
                      {showDebug ? <div className="mono muted">{answer.member_url}</div> : null}
                      {answer.status === 'ok' ? (
                        <p className="answer-text diff-text">
                          {renderDiffText(
                            baselineText,
                            answer.answer_text,
                            showDiff && !isBaseline
                          )}
                        </p>
                      ) : (
                        <div className="banner banner-error">
                          {answer.error || 'Answer failed'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {showDiff && baselineText ? (
                <div className="diff-legend">
                  <span className="diff-swatch" />
                  <span className="muted">Highlighted text differs from baseline output.</span>
                </div>
              ) : null}
            </>
          )}
          <div className="table-title">Latency & reliability</div>
          <table className="latency-table">
            <thead>
              <tr>
                <th>Anon ID</th>
                <th>Latency (ms)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {answers.map((answer) => (
                <tr key={`${answer.anon_id}-${answer.member_url}`}>
                  <td className="mono">{answer.anon_id || '-'}</td>
                  <td>{answer.latency_ms ?? '-'}</td>
                  <td className={`status-text ${answer.status}`}>{answer.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </CollapsibleCard>
  );
}
