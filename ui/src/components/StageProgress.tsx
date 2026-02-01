export type StageStatus = 'idle' | 'running' | 'done' | 'error';

interface StageProgressProps {
  status: {
    stage1: StageStatus;
    stage2: StageStatus;
    stage3: StageStatus;
  };
}

const stages = [
  { key: 'stage1', title: 'Stage 1', caption: 'Collect answers' },
  { key: 'stage2', title: 'Stage 2', caption: 'Peer review + ranking' },
  { key: 'stage3', title: 'Stage 3', caption: 'Chairman synthesis' }
] as const;

export default function StageProgress({ status }: StageProgressProps) {
  return (
    <section className="card stage-card">
      <div className="card-header">
        <h2>Council Workflow</h2>
      </div>
      <div className="workflow-track">
        {stages.map((stage) => (
          <div key={stage.key} className="workflow-step">
            <div className={`workflow-dot ${status[stage.key]}`} />
            <div className="workflow-meta">
              <div className="stage-title">{stage.title}</div>
              <div className="muted">{stage.caption}</div>
            </div>
            <span className={`stage-pill ${status[stage.key]}`}>{status[stage.key]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
