import { useEffect, useState } from 'react';
import {
  deleteRunById,
  fetchRunById,
  fetchRuns,
  getHealth,
  getOrchestratorUrl,
  getRequest,
  stage1,
  stage2,
  stage3,
  type RunSummary,
  type RequestStateResponse,
  type Stage1Response
} from './api';
import HealthBar from './components/HealthBar';
import StageProgress, { type StageStatus } from './components/StageProgress';
import AnswerPanel from './components/AnswerPanel';
import ReviewPanel from './components/ReviewPanel';
import RankingPanel from './components/RankingPanel';
import FinalPanel from './components/FinalPanel';
import ModelDashboard from './components/ModelDashboard';
import CollapsibleCard from './components/CollapsibleCard';

const initialStageStatus: { stage1: StageStatus; stage2: StageStatus; stage3: StageStatus } = {
  stage1: 'idle',
  stage2: 'idle',
  stage3: 'idle'
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const stored = window.localStorage.getItem('ui-theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [query, setQuery] = useState('');
  const [requestId, setRequestId] = useState('');
  const [loadId, setLoadId] = useState('');
  const [requestData, setRequestData] = useState<RequestStateResponse | null>(null);
  const [stageStatus, setStageStatus] = useState(initialStageStatus);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [demoStable, setDemoStable] = useState(false);
  const [copyNote, setCopyNote] = useState('');
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof getHealth>> | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const orchUrl = getOrchestratorUrl();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('ui-theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await getHealth();
        if (!active) {
          return;
        }
        setHealth(data);
        setHealthError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!active) {
          return;
        }
        setHealthError(message);
      }
    }

    poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const refreshHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const data = await fetchRuns(20);
      setRunHistory(data);
      setHistoryError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHistoryError(message);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  const syncStatusFromRequest = (data: RequestStateResponse) => {
    const next = { ...initialStageStatus };
    if (data.stage1.answers.length > 0) {
      next.stage1 = 'done';
    }
    if (data.stage2.reviews.length > 0 || data.stage2.aggregated_ranking.length > 0) {
      next.stage2 = 'done';
    }
    if (data.stage3.status === 'ok') {
      next.stage3 = 'done';
    } else if (data.stage3.status === 'error') {
      next.stage3 = 'error';
    }
    setStageStatus(next);
  };

  const runPipeline = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Enter a query to run.');
      return;
    }

    setError(null);
    setIsRunning(true);
    setStageStatus({ stage1: 'running', stage2: 'idle', stage3: 'idle' });

    let currentStage: 'stage1' | 'stage2' | 'stage3' | null = 'stage1';
    const stageOptions = demoStable ? { temperature: 0 } : undefined;

    try {
      const stage1Response: Stage1Response = await stage1(trimmed, stageOptions);
      setRequestId(stage1Response.request_id);

      setStageStatus({ stage1: 'done', stage2: 'idle', stage3: 'idle' });
      const stateAfterStage1 = await getRequest(stage1Response.request_id);
      setRequestData(stateAfterStage1);
      refreshHistory();

      const okAnswers = stage1Response.answers.filter((answer) => answer.status === 'ok').length;
      if (okAnswers < 2) {
        throw new Error('Need at least 2 successful answers to continue.');
      }

      currentStage = 'stage2';
      setStageStatus({ stage1: 'done', stage2: 'running', stage3: 'idle' });
      await stage2(stage1Response.request_id, stageOptions);
      setStageStatus({ stage1: 'done', stage2: 'done', stage3: 'running' });
      const stateAfterStage2 = await getRequest(stage1Response.request_id);
      setRequestData(stateAfterStage2);

      currentStage = 'stage3';
      const stage3Response = await stage3(stage1Response.request_id, stageOptions);
      if (stage3Response.status === 'error') {
        throw new Error(stage3Response.error || 'Stage 3 failed.');
      }
      setStageStatus({ stage1: 'done', stage2: 'done', stage3: 'done' });
      const stateAfterStage3 = await getRequest(stage1Response.request_id);
      setRequestData(stateAfterStage3);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (currentStage) {
        const stageKey = currentStage as keyof typeof initialStageStatus;
        setStageStatus((prev) => ({ ...prev, [stageKey]: 'error' }));
      }
    } finally {
      setIsRunning(false);
    }
  };

  const loadRequest = async () => {
    const trimmed = loadId.trim();
    if (!trimmed) {
      setError('Enter a request id.');
      return;
    }
    setError(null);
    try {
      let data: RequestStateResponse;
      try {
        data = await fetchRunById(trimmed);
      } catch {
        data = await getRequest(trimmed);
      }
      setRequestData(data);
      setRequestId(data.request_id);
      setQuery(data.query);
      syncStatusFromRequest(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const reset = () => {
    setQuery('');
    setRequestId('');
    setLoadId('');
    setRequestData(null);
    setStageStatus(initialStageStatus);
    setError(null);
  };

  const copyRequestId = async () => {
    if (!requestId) {
      setCopyNote('No request_id to copy');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(requestId);
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = requestId;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setCopyNote('Copied');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCopyNote(`Copy failed: ${message}`);
    }

    window.setTimeout(() => setCopyNote(''), 2000);
  };

  const exportJson = async () => {
    if (!requestId) {
      setError('No request_id available to export.');
      return;
    }

    try {
      const data =
        requestData && requestData.request_id === requestId
          ? requestData
          : await fetchRunById(requestId).catch(() => getRequest(requestId));
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `LLM_Council_Run_${requestId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const loadRunFromHistory = async (runId: string) => {
    setError(null);
    try {
      const data = await fetchRunById(runId);
      setRequestData(data);
      setRequestId(data.request_id);
      setQuery(data.query);
      syncStatusFromRequest(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const deleteRun = async (runId: string) => {
    setError(null);
    try {
      await deleteRunById(runId);
      if (requestId === runId) {
        setRequestData(null);
        setRequestId('');
      }
      refreshHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const formatQuery = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length <= 80) {
      return trimmed;
    }
    return `${trimmed.slice(0, 80)}…`;
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">LLM Council</p>
          <h1>Consensus-driven answers with transparent stages.</h1>
          <p className="lead">
            Run a query through Stage 1 answers, Stage 2 peer reviews, and a Stage 3 chairman
            synthesis. Everything stays local.
          </p>
        </div>
        <div className="hero-card">
          <div className="label">Request</div>
          <div className="mono">{requestId || 'No request yet'}</div>
          <div className="hero-actions">
            <button type="button" className="secondary" onClick={reset} disabled={isRunning}>
              Reset
            </button>
            <button type="button" className="secondary" onClick={copyRequestId} disabled={!requestId}>
              Copy request_id
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            {requestData?.stage3?.status &&
            requestData.stage3.status !== 'pending' ? (
              <button type="button" className="secondary" onClick={exportJson}>
                Export JSON
              </button>
            ) : null}
            {copyNote ? <div className="muted">{copyNote}</div> : null}
          </div>
        </div>
      </header>

      <HealthBar health={health} error={healthError} orchUrl={orchUrl} />
      <ModelDashboard health={health} request={requestData} stageStatus={stageStatus} />

      <CollapsibleCard
        title="Run History"
        className="history-card"
        defaultOpen={false}
        headerRight={
          <button
            type="button"
            className="secondary"
            onClick={refreshHistory}
            disabled={isHistoryLoading}
          >
            {isHistoryLoading ? 'Refreshing...' : 'Refresh history'}
          </button>
        }
      >
        {historyError ? <div className="banner banner-error">{historyError}</div> : null}
        {!runHistory.length ? (
          <div className="muted">No persisted runs yet.</div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Query</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runHistory.map((run) => {
                const parsedDate = new Date(run.created_at);
                const timestamp = Number.isNaN(parsedDate.getTime())
                  ? run.created_at
                  : parsedDate.toLocaleString();
                return (
                  <tr key={run.request_id}>
                    <td className="mono">{timestamp}</td>
                    <td>{formatQuery(run.query)}</td>
                    <td className="history-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => loadRunFromHistory(run.request_id)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => deleteRun(run.request_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CollapsibleCard>

      <section className="card controls">
        <div className="card-header">
          <h2>Run a Query</h2>
        </div>
        {error ? <div className="banner banner-error">{error}</div> : null}
        <div className="control-grid">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask a question for the council..."
            rows={4}
          />
          <div className="control-actions">
            <button type="button" onClick={runPipeline} disabled={isRunning}>
              {isRunning ? 'Running...' : 'Run Pipeline'}
            </button>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showDebug}
                onChange={(event) => setShowDebug(event.target.checked)}
              />
              <span>Show member URLs</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={demoStable}
                onChange={(event) => setDemoStable(event.target.checked)}
              />
              <span>Demo stability mode</span>
            </label>
          </div>
        </div>
        <div className="control-grid secondary-controls">
          <input
            value={loadId}
            onChange={(event) => setLoadId(event.target.value)}
            placeholder="Load by request_id"
          />
          <button type="button" className="secondary" onClick={loadRequest}>
            Load request
          </button>
        </div>
      </section>

      <StageProgress status={stageStatus} />

      <div className="stage-grid-layout">
        <AnswerPanel answers={requestData?.stage1.answers ?? []} showDebug={showDebug} />
        <ReviewPanel reviews={requestData?.stage2.reviews ?? []} />
        <RankingPanel ranking={requestData?.stage2.aggregated_ranking ?? []} />
        <FinalPanel stage3={requestData?.stage3 ?? null} />
      </div>
    </div>
  );
}
