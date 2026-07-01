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
  sessions: Array<{
    id: string;
    association: "explicit" | "inferred";
    requests: number;
    model: string;
    inputTokens: number;
    outputTokens: number;
    lastActivity: string;
  }>;
  recentRequests: Array<{
    id: string;
    sessionId: string;
    model: string;
    timestamp: string;
    statusCode: number | null;
    durationMs: number | null;
    inputTokens: number;
    outputTokens: number;
    provenance: string;
  }>;
  system: {
    mode: "observe";
    persistence: {
      degraded: boolean;
      droppedEvents: number;
    };
    version: string;
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
  const response = await fetch("/api/admin/session", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, "The dashboard link expired or was already used.");
  }
}

export async function loadOverview(): Promise<DashboardOverview> {
  const response = await fetch("/api/dashboard/overview", {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.status === 401
        ? "Open a fresh dashboard link from the Token Shuffle CLI."
        : "The dashboard data could not be loaded.",
    );
  }
  return (await response.json()) as DashboardOverview;
}

export async function signOut(): Promise<void> {
  await fetch("/api/admin/session", {
    method: "DELETE",
    credentials: "include",
  });
}
