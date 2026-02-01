import type { Stage2Review } from '../api';
import CollapsibleCard from './CollapsibleCard';

interface ReviewPanelProps {
  reviews: Stage2Review[];
}

export default function ReviewPanel({ reviews }: ReviewPanelProps) {
  return (
    <CollapsibleCard title="Stage 2: Peer Reviews">
      {!reviews.length ? (
        <div className="muted">No reviews yet.</div>
      ) : (
        <>
          <div className="table-title">Latency & reliability</div>
          <table className="latency-table">
            <thead>
              <tr>
                <th>Reviewer</th>
                <th>Latency (ms)</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={`row-${review.reviewer_url}`}>
                  <td className="mono">{review.reviewer_url}</td>
                  <td>{review.latency_ms ?? '-'}</td>
                  <td>
                    {review.confidence !== undefined ? review.confidence.toFixed(2) : '-'}
                  </td>
                  <td className={`status-text ${review.status}`}>{review.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="review-list">
            {reviews.map((review) => (
              <div key={review.reviewer_url} className="review-item">
                <div className="review-header">
                  <div>
                    <div className="label">Reviewer</div>
                    <div className="mono">{review.reviewer_url}</div>
                  </div>
                  <span className={`status-pill ${review.status}`}>{review.status}</span>
                </div>
                {review.latency_ms !== undefined ? (
                  <div className="muted">Latency: {review.latency_ms} ms</div>
                ) : null}
                {review.status === 'ok' ? (
                  <>
                    <div className="review-row">
                      <div className="label">Rankings</div>
                      <div className="mono">{review.rankings?.join(' > ') || 'N/A'}</div>
                    </div>
                    <div className="review-row">
                      <div className="label">Confidence</div>
                      <div className="mono">
                        {review.confidence !== undefined ? review.confidence.toFixed(2) : 'N/A'}
                      </div>
                    </div>
                    <details className="critique-block">
                      <summary>Critiques</summary>
                      {review.critiques && Object.keys(review.critiques).length > 0 ? (
                        <ul>
                          {Object.entries(review.critiques).map(([anonId, critique]) => (
                            <li key={anonId}>
                              <span className="mono">{anonId}</span>: {critique}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="muted">No critiques provided.</div>
                      )}
                    </details>
                  </>
                ) : (
                  <div className="banner banner-error">{review.error || 'Review failed'}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </CollapsibleCard>
  );
}
