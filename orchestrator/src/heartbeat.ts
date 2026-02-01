import { chairmanHealth } from './chairmanClient';
import { health as memberHealth } from './councilClient';

export type HeartbeatStatus = {
  status: 'ok' | 'error' | 'unknown';
  last_checked_at?: string;
  last_ok_at?: string;
  last_error_at?: string;
  last_latency_ms?: number;
  consecutive_failures: number;
  last_error?: string;
  last_response?: unknown;
};

export type HeartbeatSnapshot = {
  interval_ms: number;
  timeout_ms: number;
  updated_at: string;
  members: Record<string, HeartbeatStatus>;
  chairman: {
    url: string;
    status: HeartbeatStatus;
  };
};

export interface HeartbeatMonitor {
  getSnapshot: () => HeartbeatSnapshot;
  stop: () => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createStatus(): HeartbeatStatus {
  return {
    status: 'unknown',
    consecutive_failures: 0
  };
}

function markOk(status: HeartbeatStatus, latency_ms: number, response: unknown): void {
  status.status = 'ok';
  status.last_checked_at = nowIso();
  status.last_ok_at = status.last_checked_at;
  status.last_latency_ms = latency_ms;
  status.consecutive_failures = 0;
  status.last_error = undefined;
  status.last_response = response;
}

function markError(status: HeartbeatStatus, latency_ms: number | undefined, message: string): void {
  status.status = 'error';
  status.last_checked_at = nowIso();
  status.last_error_at = status.last_checked_at;
  status.last_latency_ms = latency_ms;
  status.consecutive_failures += 1;
  status.last_error = message;
}

export function startHeartbeatMonitor({
  memberUrls,
  chairmanUrl,
  intervalMs,
  timeoutMs
}: {
  memberUrls: string[];
  chairmanUrl: string;
  intervalMs: number;
  timeoutMs: number;
}): HeartbeatMonitor {
  const members: Record<string, HeartbeatStatus> = {};
  for (const url of memberUrls) {
    members[url] = createStatus();
  }

  const chairman = {
    url: chairmanUrl,
    status: createStatus()
  };

  let updatedAt = nowIso();
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const runOnce = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await Promise.all(
        memberUrls.map(async (memberUrl) => {
          const start = Date.now();
          try {
            const data = await memberHealth(memberUrl, timeoutMs);
            markOk(members[memberUrl], Date.now() - start, data);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            markError(members[memberUrl], Date.now() - start, message);
          }
        })
      );

      const start = Date.now();
      try {
        const data = await chairmanHealth(chairmanUrl, timeoutMs);
        markOk(chairman.status, Date.now() - start, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        markError(chairman.status, Date.now() - start, message);
      }
      updatedAt = nowIso();
    } finally {
      running = false;
    }
  };

  void runOnce();
  timer = setInterval(() => {
    void runOnce();
  }, intervalMs);

  return {
    getSnapshot: () => ({
      interval_ms: intervalMs,
      timeout_ms: timeoutMs,
      updated_at: updatedAt,
      members,
      chairman
    }),
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };
}
