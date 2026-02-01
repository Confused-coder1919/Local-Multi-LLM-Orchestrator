import type { RequestStateResponse } from '../api';
import CollapsibleCard from './CollapsibleCard';

interface FinalPanelProps {
  stage3: RequestStateResponse['stage3'] | null;
}

export default function FinalPanel({ stage3 }: FinalPanelProps) {
  if (!stage3) {
    return (
      <CollapsibleCard title="Stage 3: Final Answer">
        <div className="muted">No synthesis yet.</div>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard
      title="Stage 3: Final Answer"
      className="final-card"
      headerRight={<span className={`status-pill ${stage3.status}`}>{stage3.status}</span>}
    >
      {stage3.status === 'error' ? (
        <div className="banner banner-error">{stage3.error || 'Stage 3 failed'}</div>
      ) : null}
      {stage3.latency_ms !== undefined ? (
        <div className="muted">Chairman latency: {stage3.latency_ms} ms</div>
      ) : null}
      {stage3.final_answer ? (
        <div className="final-answer">{stage3.final_answer}</div>
      ) : (
        <div className="muted">Final answer not available yet.</div>
      )}
      {stage3.rationale ? (
        <div className="rationale">
          <div className="label">Rationale</div>
          <p>{stage3.rationale}</p>
        </div>
      ) : null}
      {stage3.used_signals ? (
        <div className="used-signals">
          <div className="label">Used Signals</div>
          <pre>{JSON.stringify(stage3.used_signals, null, 2)}</pre>
        </div>
      ) : null}
    </CollapsibleCard>
  );
}
