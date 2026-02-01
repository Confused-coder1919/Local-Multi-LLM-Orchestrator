import type { HealthResponse, RequestStateResponse, Stage2Review, Stage1Answer } from '../api';
import type { StageStatus } from './StageProgress';

interface ModelDashboardProps {
  health: HealthResponse | null;
  request: RequestStateResponse | null;
  stageStatus: {
    stage1: StageStatus;
    stage2: StageStatus;
    stage3: StageStatus;
  };
}

type ModelState = 'running' | 'idle' | 'unavailable';

interface ModelRow {
  key: string;
  role: 'Member' | 'Chairman';
  modelName: string;
  modelId: string;
  status: ModelState;
  stage1Latency?: number;
  stage2Latency?: number;
  stage3Latency?: number;
  heartbeatLatency?: number;
  lastOk?: string;
}

function formatLatency(value?: number): string {
  if (value === undefined) {
    return '-';
  }
  return `${value} ms`;
}

function formatTime(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
}

function buildAnswerMap(answers: Stage1Answer[] | undefined): Map<string, Stage1Answer> {
  const map = new Map<string, Stage1Answer>();
  if (!answers) {
    return map;
  }
  for (const answer of answers) {
    map.set(answer.member_url, answer);
  }
  return map;
}

function buildReviewMap(reviews: Stage2Review[] | undefined): Map<string, Stage2Review> {
  const map = new Map<string, Stage2Review>();
  if (!reviews) {
    return map;
  }
  for (const review of reviews) {
    map.set(review.reviewer_url, review);
  }
  return map;
}

export default function ModelDashboard({ health, request, stageStatus }: ModelDashboardProps) {
  const answerByUrl = buildAnswerMap(request?.stage1.answers);
  const reviewByUrl = buildReviewMap(request?.stage2.reviews);
  const urlByAnon = new Map<string, string>();
  request?.stage1.answers?.forEach((answer) => {
    urlByAnon.set(answer.anon_id, answer.member_url);
  });

  const memberRows: ModelRow[] =
    health?.members.map((member) => {
      const heartbeat = health.heartbeat?.members?.[member.member_url];
      const modelName =
        typeof member.data?.model_name === 'string' ? member.data.model_name : 'unknown';
      const modelId =
        typeof member.data?.member_id === 'string' ? member.data.member_id : 'member';
      const answer = answerByUrl.get(member.member_url);
      const review = reviewByUrl.get(member.member_url);
      const hasActivity = Boolean(answer || review);
      const pipelineActive = stageStatus.stage1 === 'running' || stageStatus.stage2 === 'running';

      let status: ModelState = 'idle';
      if (member.status !== 'ok') {
        status = 'unavailable';
      } else if (hasActivity || pipelineActive) {
        status = 'running';
      }

      return {
        key: member.member_url,
        role: 'Member',
        modelName,
        modelId,
        status,
        stage1Latency: answer?.latency_ms,
        stage2Latency: review?.latency_ms,
        heartbeatLatency: heartbeat?.last_latency_ms,
        lastOk: heartbeat?.last_ok_at
      };
    }) ?? [];

  const chairmanRow: ModelRow | null = health
    ? (() => {
        const heartbeat = health.heartbeat?.chairman?.status;
        const modelName =
          typeof health.chairman.data?.model_name === 'string'
            ? health.chairman.data.model_name
            : 'unknown';
        const modelId =
          typeof health.chairman.data?.chairman_id === 'string'
            ? health.chairman.data.chairman_id
            : 'chairman';
        const hasActivity = Boolean(request?.stage3?.status && request.stage3.status !== 'pending');
        const pipelineActive = stageStatus.stage3 === 'running';

        let status: ModelState = 'idle';
        if (health.chairman.status !== 'ok') {
          status = 'unavailable';
        } else if (hasActivity || pipelineActive) {
          status = 'running';
        }

        return {
          key: health.chairman.chairman_url,
          role: 'Chairman',
          modelName,
          modelId,
          status,
          stage3Latency: request?.stage3?.latency_ms,
          heartbeatLatency: heartbeat?.last_latency_ms,
          lastOk: heartbeat?.last_ok_at
        };
      })()
    : null;

  const rankingEntries =
    request?.stage2?.aggregated_ranking?.map((entry, index) => {
      const memberUrl = urlByAnon.get(entry.anon_id);
      const healthEntry = health?.members.find((member) => member.member_url === memberUrl);
      const modelName =
        healthEntry && typeof healthEntry.data?.model_name === 'string'
          ? healthEntry.data.model_name
          : 'unknown';
      return {
        rank: index + 1,
        anon: entry.anon_id,
        score: entry.score,
        model: modelName
      };
    }) ?? [];

  return (
    <section className="card dashboard-card">
      <div className="card-header">
        <h2>Model Performance Dashboard</h2>
        <div className="muted">
          {request?.created_at ? `Last run: ${formatTime(request.created_at)}` : 'No run yet'}
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-block">
          <div className="table-title">Latency & response time</div>
          {!health ? (
            <div className="muted">Waiting for health data...</div>
          ) : (
            <table className="model-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Stage 1</th>
                  <th>Stage 2</th>
                  <th>Stage 3</th>
                  <th>Heartbeat</th>
                  <th>Last ok</th>
                </tr>
              </thead>
              <tbody>
                {[...memberRows, ...(chairmanRow ? [chairmanRow] : [])].map((row) => (
                  <tr key={row.key}>
                    <td>{row.role}</td>
                    <td>
                      <div className="mono">{row.modelName}</div>
                      <div className="muted">{row.modelId}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${row.status}`}>{row.status}</span>
                    </td>
                    <td>{formatLatency(row.stage1Latency)}</td>
                    <td>{formatLatency(row.stage2Latency)}</td>
                    <td>{formatLatency(row.stage3Latency)}</td>
                    <td>{formatLatency(row.heartbeatLatency)}</td>
                    <td>{formatTime(row.lastOk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="dashboard-block">
          <div className="table-title">Ranking results</div>
          {!rankingEntries.length ? (
            <div className="muted">No ranking yet.</div>
          ) : (
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Anon ID</th>
                  <th>Score</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {rankingEntries.map((entry) => (
                  <tr key={entry.anon}>
                    <td className="mono">{entry.rank}</td>
                    <td className="mono">{entry.anon}</td>
                    <td>{entry.score}</td>
                    <td className="mono">{entry.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="status-legend">
            <span className="label">Status</span>
            <span className="status-pill running">running</span>
            <span className="status-pill idle">idle</span>
            <span className="status-pill unavailable">unavailable</span>
          </div>
        </div>
      </div>
    </section>
  );
}
