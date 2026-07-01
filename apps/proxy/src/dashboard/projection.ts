import type { ObservationEvent } from "../observation/events.js";

export interface DashboardOverview {
  readonly generatedAt: string;
  readonly summary: {
    readonly requests: number;
    readonly sessions: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly literalInputTokensAvoided: number;
    readonly cacheReadInputTokens: number;
    readonly averageLatencyMs: number;
  };
  readonly provenance: {
    readonly providerReportedRequests: number;
    readonly estimatedRequests: number;
  };
  readonly sessions: readonly DashboardSession[];
  readonly recentRequests: readonly DashboardRequest[];
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
  readonly model: string;
  readonly timestamp: string;
  readonly statusCode: number | null;
  readonly durationMs: number | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly provenance: string;
}

interface MutableRequest {
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

export function projectDashboard(events: readonly ObservationEvent[]): DashboardOverview {
  const requests = new Map<string, MutableRequest>();
  for (const event of events) {
    const request = requests.get(event.requestId) ?? {
      id: event.requestId,
      sessionId: event.session.id,
      association: event.session.association,
      model: event.model,
      timestamp: event.timestamp,
      statusCode: null,
      durationMs: null,
      inputTokens: 0,
      outputTokens: 0,
      literalInputTokensAvoided: 0,
      cacheReadInputTokens: 0,
      provenance: "estimate",
    };
    if (event.timestamp > request.timestamp) request.timestamp = event.timestamp;
    if (event.type === "request.measured") {
      request.inputTokens = numberValue(event.data.forwardedInputTokens);
      request.literalInputTokensAvoided = numberValue(
        event.data.literalInputTokensAvoided,
      );
      request.provenance = stringValue(event.data.provenance, request.provenance);
    } else if (event.type === "attempt.usage") {
      request.inputTokens = numberValue(event.data.inputTokens, request.inputTokens);
      request.outputTokens = numberValue(event.data.outputTokens);
      request.cacheReadInputTokens = numberValue(event.data.cacheReadInputTokens);
      request.provenance = stringValue(event.data.provenance, request.provenance);
    } else if (event.type === "request.completed") {
      request.statusCode = numberOrNull(event.data.statusCode);
      request.durationMs = numberOrNull(event.data.durationMs);
    }
    requests.set(event.requestId, request);
  }

  const completed = [...requests.values()]
    .filter((request) => request.statusCode !== null)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  const sessions = new Map<string, DashboardSession>();
  for (const request of completed) {
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

  const latencyValues = completed
    .map((request) => request.durationMs)
    .filter((value): value is number => value !== null);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      requests: completed.length,
      sessions: sessions.size,
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
    sessions: [...sessions.values()]
      .sort((left, right) => right.lastActivity.localeCompare(left.lastActivity))
      .slice(0, 8),
    recentRequests: completed.slice(0, 12).map((request) => ({
      id: request.id,
      sessionId: request.sessionId,
      model: request.model,
      timestamp: request.timestamp,
      statusCode: request.statusCode,
      durationMs: request.durationMs,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
      provenance: request.provenance,
    })),
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
