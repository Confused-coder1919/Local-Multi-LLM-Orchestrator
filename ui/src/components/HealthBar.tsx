import type { HealthResponse } from '../api';

interface HealthBarProps {
  health: HealthResponse | null;
  error: string | null;
  orchUrl: string;
}

function formatTime(value?: string): string {
  if (!value) {
    return 'n/a';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
}

export default function HealthBar({ health, error, orchUrl }: HealthBarProps) {
  return (
    <section className="card health-card">
      <div className="card-header">
        <h2>Service Health</h2>
        <span className="muted">{orchUrl}</span>
      </div>
      {error ? (
        <div className="banner banner-error">Health check failed: {error}</div>
      ) : null}
      {!health ? (
        <div className="muted">Checking services...</div>
      ) : (
        <>
          <div className="health-summary">
            <span className={`status-pill ${health.ok ? 'ok' : 'error'}`}>
              {health.ok ? 'ok' : 'degraded'}
            </span>
            <span className="muted">
              Members ok: {health.members.filter((member) => member.status === 'ok').length}/
              {health.members.length}
            </span>
            <span className="muted">Chairman: {health.chairman.status}</span>
            <span className="muted">
              Heartbeat: {formatTime(health.heartbeat?.updated_at)}
            </span>
          </div>
          <details className="health-details">
            <summary>Show per-model details</summary>
            <div className="health-grid">
              {health.members.map((member) => {
                const heartbeat = health.heartbeat?.members?.[member.member_url];
                const modelName =
                  typeof member.data?.model_name === 'string' ? member.data.model_name : 'unknown';
                const memberId =
                  typeof member.data?.member_id === 'string' ? member.data.member_id : 'member';
                return (
                  <div key={member.member_url} className="health-item">
                    <span className={`status-dot ${member.status}`} />
                    <div className="health-meta">
                      <div className="label">Member</div>
                      <div className="mono">{memberId}</div>
                      <div className="health-row">
                        <span className="label">Model</span>
                        <span className="mono">{modelName}</span>
                      </div>
                      <div className="health-row">
                        <span className="label">Availability</span>
                        <span className={`status-pill ${member.status}`}>{member.status}</span>
                      </div>
                      <div className="health-row">
                        <span className="label">Load</span>
                        <span className="mono">
                          {heartbeat?.last_latency_ms !== undefined
                            ? `${heartbeat.last_latency_ms} ms`
                            : 'n/a'}
                        </span>
                      </div>
                      <div className="muted">
                        Heartbeat: {heartbeat?.status ?? 'unknown'} | Last ok:{' '}
                        {formatTime(heartbeat?.last_ok_at)}
                      </div>
                      <div className="mono muted">{member.member_url}</div>
                    </div>
                  </div>
                );
              })}
              <div className="health-item">
                <span className={`status-dot ${health.chairman.status}`} />
                <div className="health-meta">
                  <div className="label">Chairman</div>
                  <div className="mono">
                    {typeof health.chairman.data?.chairman_id === 'string'
                      ? health.chairman.data.chairman_id
                      : 'chairman'}
                  </div>
                  <div className="health-row">
                    <span className="label">Model</span>
                    <span className="mono">
                      {typeof health.chairman.data?.model_name === 'string'
                        ? health.chairman.data.model_name
                        : 'unknown'}
                    </span>
                  </div>
                  <div className="health-row">
                    <span className="label">Availability</span>
                    <span className={`status-pill ${health.chairman.status}`}>
                      {health.chairman.status}
                    </span>
                  </div>
                  <div className="health-row">
                    <span className="label">Load</span>
                    <span className="mono">
                      {health.heartbeat?.chairman?.status.last_latency_ms !== undefined
                        ? `${health.heartbeat?.chairman?.status.last_latency_ms} ms`
                        : 'n/a'}
                    </span>
                  </div>
                  <div className="muted">
                    Heartbeat: {health.heartbeat?.chairman?.status.status ?? 'unknown'} | Last
                    ok: {formatTime(health.heartbeat?.chairman?.status.last_ok_at)}
                  </div>
                  <div className="mono muted">{health.chairman.chairman_url}</div>
                </div>
              </div>
            </div>
          </details>
        </>
      )}
      {health ? <div className="muted">Last updated: {health.timestamp}</div> : null}
    </section>
  );
}
