import { expect, test } from "@playwright/test";

const request = {
  id: "request-1234567890",
  sessionId: "session-1234567890",
  association: "explicit",
  model: "synthetic-model",
  timestamp: "2026-06-30T10:00:02.000Z",
  statusCode: 200,
  durationMs: 1250,
  inputTokens: 118,
  outputTokens: 42,
  literalInputTokensAvoided: 0,
  optimizationTokens: 0,
  netTokensAvoided: 0,
  policyRetryCount: 0,
  cacheReadInputTokens: 80,
  provenance: "provider-reported",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/dashboard/events", (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: "event: ready\ndata: {}\n\n" }),
  );
  await page.route("**/api/dashboard/overview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: "2026-06-30T10:00:02.000Z",
        summary: {
          requests: 1,
          sessions: 1,
          inputTokens: 118,
          outputTokens: 42,
          literalInputTokensAvoided: 0,
          optimizationTokens: 0,
          netTokensAvoided: 0,
          cacheReadInputTokens: 80,
          averageLatencyMs: 1250,
        },
        provenance: { providerReportedRequests: 1, estimatedRequests: 0 },
        timeline: [{
          date: "2026-06-30",
          inputTokens: 118,
          outputTokens: 42,
          cacheReadInputTokens: 80,
          literalInputTokensAvoided: 0,
        }],
        sessions: [{
          id: request.sessionId,
          association: "explicit",
          requests: 1,
          model: request.model,
          inputTokens: 118,
          outputTokens: 42,
          lastActivity: request.timestamp,
        }],
        recentRequests: [request],
        system: {
          mode: "observe",
          persistence: { degraded: false, droppedEvents: 0 },
          version: "0.5.0",
        },
      }),
    }),
  );
  await page.route("**/api/dashboard/requests/request-1234567890", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...request,
        protocol: "openai-chat-completions",
        provider: "openai-compatible",
        attemptId: "attempt-1",
        structure: { messageCount: 4, forwardedInputTokens: 118 },
        events: [{
          id: "event-1",
          type: "request.measured",
          timestamp: request.timestamp,
          attemptId: "attempt-1",
          retentionClass: "structural",
          data: { messageCount: 4 },
        }, {
          id: "event-2",
          type: "policy.applied",
          timestamp: request.timestamp,
          attemptId: "attempt-1",
          retentionClass: "structural",
          data: {
            policy: "conversation-compaction",
            applied: true,
            sourceFingerprint:
              "hmac-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            sourceStart: 1,
            sourceEnd: 8,
            summaryVersion: "deterministic-v1",
          },
        }],
        replay: {
          available: false,
          reason: "Raw content retention is disabled.",
          baselineInputTokens: 118,
          forwardedInputTokens: 118,
          optimizationTokens: 0,
        },
      }),
    }),
  );
  await page.route(
    "**/api/dashboard/compaction/hmac-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/source",
    (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fingerprint:
          "hmac-sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        retention: "memory-only",
        source: [{ role: "user", content: "Must preserve compatibility." }],
      }),
    }),
  );
  await page.route("**/api/dashboard/diagnostics", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "optimize",
        version: "0.5.0",
        phase: "v0.5",
        server: { host: "127.0.0.1", port: 3210 },
        storage: {
          path: "/synthetic/events.sqlite",
          rawContentRetained: false,
          artifactContentRetained: true,
          structuralRetentionDays: 30,
          errorRetentionDays: 14,
          artifactRetentionDays: 7,
          eventCount: 8,
          artifactCount: 2,
          sqliteVersion: "3.51.3",
          degraded: false,
          droppedEvents: 0,
        },
        capabilities: {
          ingress: ["openai-chat-completions"],
          providers: ["openai-compatible"],
          streaming: true,
          retries: false,
          retrieval: true,
        },
        policies: {
          mode: "optimize",
          killSwitch: false,
          toolOutput: {
            enabled: true,
            collapseRepeatedLinesAfter: 3,
            maximumInputCharacters: 65536,
          },
          exactRedundancy: { enabled: true },
          conversationCompaction: {
            enabled: true,
            minimumMessages: 12,
            activeWindowMessages: 6,
            maximumSourceCharacters: 256000,
          },
          retrieval: {
            enabled: true,
            maximumResults: 3,
            maximumInjectedCharacters: 24000,
          },
          dynamicToolDefinitionSelection: { mode: "shadow", retryCount: 0 },
        },
      }),
    }),
  );
});

test("explains active policy limits and kill-switch state", async ({ page }) => {
  await page.goto("/diagnostics");
  await expect(page.getByRole("heading", { name: "Diagnostics & retention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Policy preview" })).toBeVisible();
  await expect(
    page.locator(".policy-preview code").filter({ hasText: "65,536 characters" }),
  ).toBeVisible();
  await expect(page.getByText("Kill switch")).toBeVisible();
  await expect(page.getByText("Shadow")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conversation compaction" })).toBeVisible();
  await expect(page.getByText("6 active messages · 12 message minimum")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retrieval" })).toBeVisible();
  await expect(page.getByText("3 results · 24,000 characters")).toBeVisible();
  await expect(page.getByText("7 days")).toBeVisible();
});

test("traces overview evidence into a redacted request detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What the proxy observed." })).toBeVisible();
  await expect(page.getByText("Provider cache reads")).toBeVisible();
  await page.getByRole("link", { name: /request-12/i }).click();
  await expect(page.getByRole("heading", { name: "request-1234567" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Structural replay" })).toBeVisible();
  await expect(page.getByText("Raw content retention is disabled.")).toBeVisible();
  await expect(page.getByText("request.measured")).toBeVisible();
  await page.getByRole("button", { name: "Reveal source" }).click();
  await expect(page.getByText("Memory-only source")).toBeVisible();
  await expect(page.getByText(/Must preserve compatibility/)).toBeVisible();
});
