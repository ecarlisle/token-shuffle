import type { ObservationEvent } from "../observation/events.js";

export interface DashboardOverview {
  readonly generatedAt: string;
  readonly summary: DashboardSummary;
  readonly provenance: {
    readonly providerReportedRequests: number;
    readonly estimatedRequests: number;
  };
  readonly timeline: readonly DashboardTimelinePoint[];
  readonly sessions: readonly DashboardSession[];
  readonly recentRequests: readonly DashboardRequest[];
}

export interface DashboardSummary {
  readonly requests: number;
  readonly sessions: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly literalInputTokensAvoided: number;
  readonly cacheReadInputTokens: number;
  readonly averageLatencyMs: number;
}

export interface DashboardSession {
  readonly id: string;
  readonly association: "explicit" | "inferred";
  readonly requests: number;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly lastActivity: string;
}

export interface DashboardRequest {
  readonly id: string;
  readonly sessionId: string;
  readonly association: "explicit" | "inferred";
  readonly model: string;
  readonly timestamp: string;
  readonly statusCode: number | null;
  readonly durationMs: number | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly literalInputTokensAvoided: number;
  readonly cacheReadInputTokens: number;
  readonly provenance: string;
}

export interface DashboardTimelinePoint {
  readonly date: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly literalInputTokensAvoided: number;
}

export interface DashboardRequestDetail extends DashboardRequest {
  readonly protocol: string;
  readonly provider: string;
  readonly attemptId: string | null;
  readonly structure: Readonly<Record<string, boolean | number | string | null>>;
  readonly events: readonly DashboardEvent[];
  readonly replay: {
    readonly available: false;
    readonly reason: string;
    readonly baselineInputTokens: number;
    readonly forwardedInputTokens: number;
    readonly optimizationTokens: number;
  };
}

export interface DashboardSessionDetail extends DashboardSession {
  readonly method: "x-token-shuffle-session-id" | "request";
  readonly requestsList: readonly DashboardRequest[];
}

export interface DashboardEvent {
  readonly id: string;
  readonly type: string;
  readonly timestamp: string;
  readonly attemptId: string | null;
  readonly retentionClass: "structural" | "redacted-error";
  readonly data: Readonly<Record<string, boolean | number | string | null>>;
}

interface MutableRequest
  extends Omit<
    DashboardRequest,
    | "timestamp"
    | "statusCode"
    | "durationMs"
    | "inputTokens"
    | "outputTokens"
    | "literalInputTokensAvoided"
    | "cacheReadInputTokens"
    | "provenance"
  > {
  timestamp: string;
  statusCode: number | null;
  durationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  literalInputTokensAvoided: number;
  cacheReadInputTokens: number;
  provenance: string;
  protocol: string;
  provider: string;
  attemptId: string | null;
  method: "x-token-shuffle-session-id" | "request";
  structure: Record<string, boolean | number | string | null>;
  events: ObservationEvent[];
  baselineInputTokens: number;
  forwardedInputTokens: number;
}

export function projectDashboard(events: readonly ObservationEvent[]): DashboardOverview {
  const completed = collectRequests(events).filter((request) => request.statusCode !== null);
  const sessions = collectSessions(completed);
  const latencyValues = completed
    .map((request) => request.durationMs)
    .filter((value): value is number => value !== null);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      requests: completed.length,
      sessions: sessions.length,
      inputTokens: sum(completed, "inputTokens"),
      outputTokens: sum(completed, "outputTokens"),
      literalInputTokensAvoided: sum(completed, "literalInputTokensAvoided"),
      cacheReadInputTokens: sum(completed, "cacheReadInputTokens"),
      averageLatencyMs:
        latencyValues.length === 0
          ? 0
          : Math.round(
              latencyValues.reduce((total, value) => total + value, 0) /
                latencyValues.length,
            ),
    },
    provenance: {
      providerReportedRequests: completed.filter(
        (request) => request.provenance === "provider-reported",
      ).length,
      estimatedRequests: completed.filter(
        (request) => request.provenance !== "provider-reported",
      ).length,
    },
    timeline: collectTimeline(completed),
    sessions: sessions.slice(0, 50),
    recentRequests: completed.slice(0, 100).map(publicRequest),
  };
}

export function projectRequest(
  events: readonly ObservationEvent[],
  requestId: string,
): DashboardRequestDetail | undefined {
  const request = collectRequests(events).find((candidate) => candidate.id === requestId);
  if (request === undefined) return undefined;
  return {
    ...publicRequest(request),
    protocol: request.protocol,
    provider: request.provider,
    attemptId: request.attemptId,
    structure: request.structure,
    events: request.events.map((event) => ({
      id: event.eventId,
      type: event.type,
      timestamp: event.timestamp,
      attemptId: event.attemptId ?? null,
      retentionClass: event.retentionClass,
      data: event.data,
    })),
    replay: {
      available: false,
      reason:
        "Raw content retention is disabled. This structural replay shows measurements and lifecycle events without reconstructing prompt or response content.",
      baselineInputTokens: request.baselineInputTokens,
      forwardedInputTokens: request.forwardedInputTokens,
      optimizationTokens: 0,
    },
  };
}

export function projectSession(
  events: readonly ObservationEvent[],
  sessionId: string,
): DashboardSessionDetail | undefined {
  const requests = collectRequests(events).filter(
    (request) => request.sessionId === sessionId,
  );
  if (requests.length === 0) return undefined;
  const session = collectSessions(requests)[0];
  if (session === undefined) return undefined;
  return {
    ...session,
    method: requests[0]?.method ?? "request",
    requestsList: requests.map(publicRequest),
  };
}

function collectRequests(events: readonly ObservationEvent[]): MutableRequest[] {
  const requests = new Map<string, MutableRequest>();
  for (const event of events) {
    const request = requests.get(event.requestId) ?? {
      id: event.requestId,
      sessionId: event.session.id,
      association: event.session.association,
      method: event.session.method,
      protocol: event.protocol,
      provider: event.provider,
      attemptId: event.attemptId ?? null,
      model: event.model,
      timestamp: event.timestamp,
      statusCode: null,
      durationMs: null,
      inputTokens: 0,
      outputTokens: 0,
      baselineInputTokens: 0,
      forwardedInputTokens: 0,
      literalInputTokensAvoided: 0,
      cacheReadInputTokens: 0,
      provenance: "estimate",
      structure: {},
      events: [],
    };
    request.events.push(event);
    if (event.timestamp > request.timestamp) request.timestamp = event.timestamp;
    if (event.type === "request.measured") {
      request.baselineInputTokens = numberValue(event.data.baselineInputTokens);
      request.forwardedInputTokens = numberValue(event.data.forwardedInputTokens);
      request.inputTokens = request.forwardedInputTokens;
      request.literalInputTokensAvoided = numberValue(
        event.data.literalInputTokensAvoided,
      );
      request.provenance = stringValue(event.data.provenance, request.provenance);
      request.structure = { ...event.data };
    } else if (event.type === "attempt.usage") {
      request.inputTokens = numberValue(event.data.inputTokens, request.inputTokens);
      request.outputTokens = numberValue(event.data.outputTokens);
      request.cacheReadInputTokens = numberValue(event.data.cacheReadInputTokens);
      request.provenance = stringValue(event.data.provenance, request.provenance);
    } else if (event.type === "request.completed") {
      request.statusCode = numberOrNull(event.data.statusCode);
      request.durationMs = numberOrNull(event.data.durationMs);
    } else if (event.type === "attempt.failed") {
      request.durationMs = numberOrNull(event.data.durationMs);
    }
    requests.set(event.requestId, request);
  }
  return [...requests.values()].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );
}

function collectSessions(requests: readonly MutableRequest[]): DashboardSession[] {
  const sessions = new Map<string, DashboardSession>();
  for (const request of requests) {
    const existing = sessions.get(request.sessionId);
    sessions.set(request.sessionId, {
      id: request.sessionId,
      association: request.association,
      requests: (existing?.requests ?? 0) + 1,
      model: request.model,
      inputTokens: (existing?.inputTokens ?? 0) + request.inputTokens,
      outputTokens: (existing?.outputTokens ?? 0) + request.outputTokens,
      lastActivity:
        existing === undefined || request.timestamp > existing.lastActivity
          ? request.timestamp
          : existing.lastActivity,
    });
  }
  return [...sessions.values()].sort((left, right) =>
    right.lastActivity.localeCompare(left.lastActivity),
  );
}

function collectTimeline(requests: readonly MutableRequest[]): DashboardTimelinePoint[] {
  const points = new Map<string, DashboardTimelinePoint>();
  for (const request of [...requests].reverse()) {
    const date = request.timestamp.slice(0, 10);
    const existing = points.get(date);
    points.set(date, {
      date,
      inputTokens: (existing?.inputTokens ?? 0) + request.inputTokens,
      outputTokens: (existing?.outputTokens ?? 0) + request.outputTokens,
      cacheReadInputTokens:
        (existing?.cacheReadInputTokens ?? 0) + request.cacheReadInputTokens,
      literalInputTokensAvoided:
        (existing?.literalInputTokensAvoided ?? 0) +
        request.literalInputTokensAvoided,
    });
  }
  return [...points.values()].slice(-30);
}

function publicRequest(request: MutableRequest): DashboardRequest {
  return {
    id: request.id,
    sessionId: request.sessionId,
    association: request.association,
    model: request.model,
    timestamp: request.timestamp,
    statusCode: request.statusCode,
    durationMs: request.durationMs,
    inputTokens: request.inputTokens,
    outputTokens: request.outputTokens,
    literalInputTokensAvoided: request.literalInputTokensAvoided,
    cacheReadInputTokens: request.cacheReadInputTokens,
    provenance: request.provenance,
  };
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function sum(
  values: readonly MutableRequest[],
  key:
    | "inputTokens"
    | "outputTokens"
    | "literalInputTokensAvoided"
    | "cacheReadInputTokens",
): number {
  return values.reduce((total, value) => total + value[key], 0);
}
