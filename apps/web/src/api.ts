export interface DashboardRequest {
  id: string;
  sessionId: string;
  association: "explicit" | "inferred";
  model: string;
  timestamp: string;
  statusCode: number | null;
  durationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  literalInputTokensAvoided: number;
  cacheReadInputTokens: number;
  provenance: string;
}

export interface DashboardSession {
  id: string;
  association: "explicit" | "inferred";
  requests: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  lastActivity: string;
}

export interface DashboardOverview {
  generatedAt: string;
  summary: {
    requests: number;
    sessions: number;
    inputTokens: number;
    outputTokens: number;
    literalInputTokensAvoided: number;
    cacheReadInputTokens: number;
    averageLatencyMs: number;
  };
  provenance: {
    providerReportedRequests: number;
    estimatedRequests: number;
  };
  timeline: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    literalInputTokensAvoided: number;
  }>;
  sessions: DashboardSession[];
  recentRequests: DashboardRequest[];
  system: {
    mode: "observe";
    persistence: {
      degraded: boolean;
      droppedEvents: number;
    };
    version: string;
  };
}

export interface DashboardRequestDetail extends DashboardRequest {
  protocol: string;
  provider: string;
  attemptId: string | null;
  structure: Record<string, boolean | number | string | null>;
  events: Array<{
    id: string;
    type: string;
    timestamp: string;
    attemptId: string | null;
    retentionClass: "structural" | "redacted-error";
    data: Record<string, boolean | number | string | null>;
  }>;
  replay: {
    available: false;
    reason: string;
    baselineInputTokens: number;
    forwardedInputTokens: number;
    optimizationTokens: number;
  };
}

export interface DashboardSessionDetail extends DashboardSession {
  method: "x-token-shuffle-session-id" | "request";
  requestsList: DashboardRequest[];
}

export interface DashboardDiagnostics {
  mode: "observe";
  version: string;
  phase: string;
  server: { host: string; port: number };
  storage: {
    path: string;
    rawContentRetained: boolean;
    structuralRetentionDays: number;
    errorRetentionDays: number;
    eventCount: number | null;
    sqliteVersion: string | null;
    degraded: boolean;
    droppedEvents: number;
  };
  capabilities: {
    ingress: string[];
    providers: string[];
    streaming: boolean;
    retries: boolean;
  };
}

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function exchangeBootstrap(code: string): Promise<void> {
  await request("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  }, "The dashboard link expired or was already used.");
}

export async function loadOverview(): Promise<DashboardOverview> {
  return request("/api/dashboard/overview");
}

export async function loadRequest(requestId: string): Promise<DashboardRequestDetail> {
  return request(`/api/dashboard/requests/${encodeURIComponent(requestId)}`);
}

export async function loadSession(sessionId: string): Promise<DashboardSessionDetail> {
  return request(`/api/dashboard/sessions/${encodeURIComponent(sessionId)}`);
}

export async function loadDiagnostics(): Promise<DashboardDiagnostics> {
  return request("/api/dashboard/diagnostics");
}

export async function deleteRequestEvidence(requestId: string): Promise<void> {
  await request(`/api/dashboard/requests/${encodeURIComponent(requestId)}`, {
    method: "DELETE",
  });
}

export async function deleteSessionEvidence(sessionId: string): Promise<void> {
  await request(`/api/dashboard/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function deleteAllEvidence(): Promise<void> {
  await request("/api/dashboard/history", { method: "DELETE" });
}

export async function signOut(): Promise<void> {
  await request("/api/admin/session", { method: "DELETE" });
}

export function subscribeToEvents(onEvent: () => void): () => void {
  const source = new EventSource("/api/dashboard/events", { withCredentials: true });
  source.addEventListener("observation", onEvent);
  return () => source.close();
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
  fallbackMessage = "The dashboard data could not be loaded.",
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.status === 401
        ? "Open a fresh dashboard link from the Token Shuffle CLI."
        : fallbackMessage,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
