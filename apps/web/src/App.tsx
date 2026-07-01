import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  DatabaseIcon,
  InfoIcon,
  LockKeyIcon,
  SignOutIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useParams,
} from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  deleteAllEvidence,
  deleteRequestEvidence,
  deleteSessionEvidence,
  exchangeBootstrap,
  loadDiagnostics,
  loadOverview,
  loadRequest,
  loadSession,
  signOut,
  subscribeToEvents,
  type DashboardOverview,
  type DashboardRequest,
} from "./api.js";

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const rootRoute = createRootRoute({ component: Shell });
const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});
const requestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/requests/$requestId",
  component: RequestPage,
});
const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions/$sessionId",
  component: SessionPage,
});
const diagnosticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diagnostics",
  component: DiagnosticsPage,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([
    overviewRoute,
    requestRoute,
    sessionRoute,
    diagnosticsRoute,
  ]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

type BootstrapState = "checking" | "ready" | "failed";

export function App(): React.JSX.Element {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>("checking");
  const [bootstrapError, setBootstrapError] = useState<string>();

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const code = parameters.get("bootstrap");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (code === null) {
      setBootstrapState("ready");
      return;
    }
    void exchangeBootstrap(code)
      .then(() => setBootstrapState("ready"))
      .catch((error: unknown) => {
        setBootstrapError(
          error instanceof Error ? error.message : "Dashboard authentication failed.",
        );
        setBootstrapState("failed");
      });
  }, []);

  if (bootstrapState === "checking") return <LoadingScreen />;
  if (bootstrapState === "failed") {
    return <AccessScreen message={bootstrapError ?? "Dashboard authentication failed."} />;
  }
  return (
    <Tooltip.Provider delayDuration={250}>
      <RouterProvider router={router} />
    </Tooltip.Provider>
  );
}

function Shell(): React.JSX.Element {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      subscribeToEvents(() => {
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }),
    [queryClient],
  );
  return (
    <div className="min-h-[100dvh] bg-canvas text-primary">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <Link to="/" className="brand-link">
            <span className="brand-mark" aria-hidden="true">TS</span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.01em]">Token Shuffle</span>
              <span className="block text-xs text-secondary">Evidence dashboard</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Dashboard">
            <Link to="/diagnostics" className="nav-link">Diagnostics</Link>
            <IconButton
              label="End dashboard session"
              onClick={() => void signOut().then(() => window.location.assign("/"))}
            >
              <SignOutIcon size={17} weight="bold" />
            </IconButton>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function OverviewPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: loadOverview,
    refetchInterval: 30_000,
  });
  if (overview.isLoading) return <LoadingScreen embedded />;
  if (overview.isError || overview.data === undefined) {
    return <QueryError error={overview.error} />;
  }
  const data = overview.data;
  return (
    <main className="page-shell">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-accent">Observed locally</p>
        <h1 className="page-title">What the proxy observed.</h1>
        <p className="page-intro">
          Token use, cache behavior, and latency remain separate so every conclusion
          stays inspectable.
        </p>
      </section>

      <section className="metric-grid mt-12" aria-label="Request summary">
        <Metric label="Completed requests" value={formatNumber(data.summary.requests)} />
        <Metric label="Input tokens" value={formatCompact(data.summary.inputTokens)} />
        <Metric label="Output tokens" value={formatCompact(data.summary.outputTokens)} />
        <Metric label="Net tokens avoided" value={formatCompact(data.summary.netTokensAvoided)} />
      </section>

      <section className="mt-14">
        <SectionHeading
          title="Token evidence"
          detail="Daily totals; cache reads are not counted as reduction"
        />
        <EvidenceChart overview={data} />
      </section>

      <div className="mt-14 grid gap-12 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
        <section>
          <SectionHeading
            title="Recent requests"
            detail={`${data.provenance.providerReportedRequests} provider-reported, ${data.provenance.estimatedRequests} estimated`}
          />
          <RequestTable requests={data.recentRequests} />
        </section>
        <aside>
          <SectionHeading title="Evidence integrity" />
          <div className="integrity-panel">
            <EvidenceRow
              icon={<DatabaseIcon size={18} weight="bold" />}
              label="Persistence"
              value={data.system.persistence.degraded ? "Degraded" : "Healthy"}
              detail={`${data.system.persistence.droppedEvents} dropped events`}
            />
            <EvidenceRow
              icon={<CheckCircleIcon size={18} weight="bold" />}
              label="Literal reduction"
              value={formatCompact(data.summary.literalInputTokensAvoided)}
              detail="Tokens avoided, not cache discounts"
            />
            <EvidenceRow
              icon={<ClockIcon size={18} weight="bold" />}
              label="Provider cache reads"
              value={formatCompact(data.summary.cacheReadInputTokens)}
              detail="Reported separately from reduction"
            />
            <EvidenceRow
              icon={<LockKeyIcon size={18} weight="bold" />}
              label="Raw content"
              value="Not retained"
              detail="Structural events only"
            />
          </div>
        </aside>
      </div>

      <section className="mt-16">
        <SectionHeading
          title="Sessions"
          detail={`${data.summary.sessions} observed group${data.summary.sessions === 1 ? "" : "s"}`}
        />
        <SessionList sessions={data.sessions} />
      </section>
      <div className="mt-12 flex justify-end">
        <IconButton
          label="Refresh evidence"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["dashboard"] })}
        >
          <ArrowClockwiseIcon
            size={17}
            weight="bold"
            className={overview.isFetching ? "motion-safe:animate-spin" : ""}
          />
        </IconButton>
      </div>
    </main>
  );
}

function RequestPage(): React.JSX.Element {
  const { requestId } = useParams({ from: "/requests/$requestId" });
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["dashboard", "request", requestId],
    queryFn: () => loadRequest(requestId),
  });
  if (detail.isLoading) return <LoadingScreen embedded />;
  if (detail.isError || detail.data === undefined) return <QueryError error={detail.error} />;
  const request = detail.data;
  return (
    <main className="page-shell">
      <BackLink />
      <div className="detail-header">
        <div>
          <p className="text-sm text-secondary">Request evidence</p>
          <h1 className="detail-title">{shortId(request.id, 16)}</h1>
          <p className="mt-3 font-mono text-xs text-tertiary">{request.id}</p>
        </div>
        <DangerButton
          label="Delete request"
          onConfirm={async () => {
            await deleteRequestEvidence(request.id);
            await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            await router.navigate({ to: "/" });
          }}
        />
      </div>
      <section className="detail-grid mt-10">
        <Fact label="Model" value={request.model} />
        <Fact label="Provider" value={request.provider} />
        <Fact label="Protocol" value={request.protocol} />
        <Fact label="Status" value={String(request.statusCode ?? "incomplete")} />
        <Fact label="Input tokens" value={`${formatNumber(request.inputTokens)} · ${request.provenance}`} />
        <Fact label="Output tokens" value={formatNumber(request.outputTokens)} />
        <Fact label="Cache reads" value={`${formatNumber(request.cacheReadInputTokens)} · separate`} />
        <Fact label="Latency" value={formatDuration(request.durationMs ?? 0)} />
        <Fact label="Net avoided" value={formatNumber(request.netTokensAvoided)} />
        <Fact label="Policy retries" value={formatNumber(request.policyRetryCount)} />
      </section>

      <section className="mt-14">
        <SectionHeading title="Structural replay" detail="No raw prompt or response content" />
        <div className="replay-grid">
          <ReplayColumn title="Baseline" value={request.replay.baselineInputTokens} />
          <ReplayColumn title="Forwarded" value={request.replay.forwardedInputTokens} />
          <ReplayColumn title="Optimization work" value={request.replay.optimizationTokens} />
        </div>
        <p className="notice mt-4"><InfoIcon size={18} />{request.replay.reason}</p>
      </section>

      <section className="mt-14">
        <SectionHeading title="Measured structure" />
        <dl className="structure-list">
          {Object.entries(request.structure).map(([key, value]) => (
            <div key={key}><dt>{humanize(key)}</dt><dd>{String(value)}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-14">
        <SectionHeading title="Lifecycle" detail={`${request.events.length} persisted events`} />
        <ol className="event-list">
          {request.events.map((event) => (
            <li key={event.id}>
              <span className="event-dot" />
              <div>
                <p className="font-mono text-sm">{event.type}</p>
                <p className="mt-1 text-xs text-tertiary">
                  {formatTime(event.timestamp)} · {event.retentionClass}
                </p>
              </div>
              <code>{summarizeData(event.data)}</code>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function SessionPage(): React.JSX.Element {
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["dashboard", "session", sessionId],
    queryFn: () => loadSession(sessionId),
  });
  if (detail.isLoading) return <LoadingScreen embedded />;
  if (detail.isError || detail.data === undefined) return <QueryError error={detail.error} />;
  const session = detail.data;
  return (
    <main className="page-shell">
      <BackLink />
      <div className="detail-header">
        <div>
          <p className="text-sm text-secondary">Session evidence · {session.association}</p>
          <h1 className="detail-title">{shortId(session.id, 16)}</h1>
          <p className="mt-3 text-sm text-tertiary">
            Grouped by {session.method === "request" ? "individual request inference" : "explicit client header"}
          </p>
        </div>
        <DangerButton
          label="Delete session"
          onConfirm={async () => {
            await deleteSessionEvidence(session.id);
            await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            await router.navigate({ to: "/" });
          }}
        />
      </div>
      <section className="metric-grid mt-10" aria-label="Session totals">
        <Metric label="Completed" value={`${formatNumber(session.completedRequests)}/${formatNumber(session.requests)}`} />
        <Metric label="Total tokens" value={formatCompact(session.inputTokens + session.outputTokens)} />
        <Metric label="Net avoided" value={formatCompact(session.netTokensAvoided)} />
        <Metric label="Policy retries" value={formatNumber(session.policyRetryCount)} />
      </section>
      <section className="mt-14">
        <SectionHeading title="Request sequence" />
        <RequestTable requests={session.requestsList} />
      </section>
    </main>
  );
}

function DiagnosticsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const diagnostics = useQuery({
    queryKey: ["dashboard", "diagnostics"],
    queryFn: loadDiagnostics,
  });
  if (diagnostics.isLoading) return <LoadingScreen embedded />;
  if (diagnostics.isError || diagnostics.data === undefined) {
    return <QueryError error={diagnostics.error} />;
  }
  const data = diagnostics.data;
  return (
    <main className="page-shell">
      <BackLink />
      <div className="detail-header">
        <div>
          <p className="text-sm text-secondary">Local runtime</p>
          <h1 className="detail-title">Diagnostics & retention</h1>
          <p className="page-intro">Effective non-secret settings and local evidence controls.</p>
        </div>
        <DangerButton
          label="Delete all history"
          onConfirm={async () => {
            await deleteAllEvidence();
            await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      </div>
      <section className="diagnostic-groups mt-10">
        <DiagnosticGroup title="Runtime">
          <Fact label="Version" value={data.version} />
          <Fact label="Mode" value={data.mode} />
          <Fact label="Listener" value={`${data.server.host}:${data.server.port}`} />
          <Fact label="Streaming" value={data.capabilities.streaming ? "Enabled" : "Disabled"} />
        </DiagnosticGroup>
        <DiagnosticGroup title="Storage">
          <Fact label="Database" value={data.storage.path} />
          <Fact label="SQLite" value={data.storage.sqliteVersion ?? "Unavailable"} />
          <Fact label="Events" value={formatNumber(data.storage.eventCount ?? 0)} />
          <Fact label="Raw content" value={data.storage.rawContentRetained ? "Enabled" : "Disabled"} />
        </DiagnosticGroup>
        <DiagnosticGroup title="Retention">
          <Fact label="Structural events" value={`${data.storage.structuralRetentionDays} days`} />
          <Fact label="Redacted errors" value={`${data.storage.errorRetentionDays} days`} />
          <Fact label="Dropped events" value={formatNumber(data.storage.droppedEvents)} />
          <Fact label="Retries" value={data.capabilities.retries ? "Enabled" : "None"} />
        </DiagnosticGroup>
        <DiagnosticGroup title="Policies">
          <Fact label="Mode" value={data.policies.mode} />
          <Fact label="Kill switch" value={data.policies.killSwitch ? "Active" : "Inactive"} />
          <Fact label="Tool output" value={data.policies.toolOutput.enabled ? "Enabled" : "Disabled"} />
          <Fact label="Policy input limit" value={`${formatNumber(data.policies.toolOutput.maximumInputCharacters)} characters`} />
          <Fact label="Exact redundancy" value={data.policies.exactRedundancy.enabled ? "Enabled" : "Disabled"} />
        </DiagnosticGroup>
      </section>
      <section className="mt-14">
        <SectionHeading title="Policy preview" detail="Effective configuration; restart to change" />
        <div className="policy-preview">
          <PolicyPreview
            name="Tool output"
            status={data.policies.toolOutput.enabled ? "Active" : "Off"}
            explanation="Cleans ANSI controls and collapses counted repeated lines. Inputs above the configured limit pass through unchanged."
            limit={`${formatNumber(data.policies.toolOutput.maximumInputCharacters)} characters`}
          />
          <PolicyPreview
            name="Exact redundancy"
            status={data.policies.exactRedundancy.enabled ? "Active" : "Off"}
            explanation="Removes only consecutive identical tool-result messages with the same tool-call identity."
            limit="Consecutive tool results only"
          />
          <PolicyPreview
            name="Tool selection"
            status="Shadow"
            explanation="Measures tool-definition scope without changing the available tool set."
            limit={`${data.policies.dynamicToolDefinitionSelection.retryCount} policy retries`}
          />
        </div>
      </section>
      <p className="notice mt-8">
        <LockKeyIcon size={18} />
        Retention periods come from local configuration. Immediate deletion is available here;
        changing policy requires editing configuration and restarting the proxy.
      </p>
    </main>
  );
}

function EvidenceChart({ overview }: { overview: DashboardOverview }): React.JSX.Element {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (element.current === null || overview.timeline.length === 0) return;
    const chart = init(element.current, undefined, { renderer: "canvas" });
    chart.setOption({
      animationDuration: 250,
      backgroundColor: "transparent",
      color: ["#276749", "#758071", "#a0a89c", "#b97837"],
      grid: { left: 8, right: 8, top: 38, bottom: 8, containLabel: true },
      legend: {
        top: 0,
        left: 0,
        textStyle: { color: "#7a8177", fontSize: 11 },
      },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: overview.timeline.map((point) => point.date.slice(5)),
        axisLine: { lineStyle: { color: "#d8dbd2" } },
        axisLabel: { color: "#7a8177" },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#7a8177" },
        splitLine: { lineStyle: { color: "#d8dbd2" } },
      },
      series: [
        { name: "Input", type: "bar", stack: "usage", data: overview.timeline.map((p) => p.inputTokens) },
        { name: "Output", type: "bar", stack: "usage", data: overview.timeline.map((p) => p.outputTokens) },
        { name: "Cache read", type: "bar", data: overview.timeline.map((p) => p.cacheReadInputTokens) },
        { name: "Literal avoided", type: "bar", data: overview.timeline.map((p) => p.literalInputTokensAvoided) },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [overview]);
  if (overview.timeline.length === 0) {
    return <div className="empty-state">Chart evidence appears after the first completed request.</div>;
  }
  return <div ref={element} className="evidence-chart" role="img" aria-label="Daily token evidence chart" />;
}

function RequestTable({ requests }: { requests: DashboardRequest[] }): React.JSX.Element {
  const columns = useMemo<ColumnDef<DashboardRequest>[]>(
    () => [
      {
        header: "Request",
        accessorKey: "id",
        cell: ({ row }) => (
          <Link
            to="/requests/$requestId"
            params={{ requestId: row.original.id }}
            className="table-link"
          >
            <span className="font-mono text-xs">{shortId(row.original.id)}</span>
            <span className="mt-1 block text-xs text-tertiary">{formatTime(row.original.timestamp)}</span>
          </Link>
        ),
      },
      {
        header: "Model",
        accessorKey: "model",
        cell: ({ row }) => (
          <>
            <p className="max-w-[220px] truncate text-sm">{row.original.model}</p>
            <p className="mt-1 text-xs text-tertiary">{row.original.provenance}</p>
          </>
        ),
      },
      { header: "Input", accessorKey: "inputTokens", cell: ({ getValue }) => formatCompact(getValue<number>()) },
      { header: "Output", accessorKey: "outputTokens", cell: ({ getValue }) => formatCompact(getValue<number>()) },
      { header: "Latency", accessorKey: "durationMs", cell: ({ getValue }) => formatDuration(getValue<number | null>() ?? 0) },
    ],
    [],
  );
  const table = useReactTable({ data: requests, columns, getCoreRowModel: getCoreRowModel() });
  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <DatabaseIcon size={24} weight="duotone" />
        <p className="font-medium">No completed requests yet</p>
        <p className="text-sm text-secondary">Send an agent request through Token Shuffle.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header, index) => (
                <th key={header.id} className={index > 1 ? "numeric" : ""}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell, index) => (
                <td key={cell.id} className={index > 1 ? "numeric" : ""}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionList({ sessions }: { sessions: DashboardOverview["sessions"] }): React.JSX.Element {
  if (sessions.length === 0) {
    return <p className="border-t border-line py-8 text-sm text-secondary">No sessions yet.</p>;
  }
  return (
    <div className="session-list">
      {sessions.map((session) => (
        <Link
          className="session-row"
          key={session.id}
          to="/sessions/$sessionId"
          params={{ sessionId: session.id }}
        >
          <span className="min-w-0">
            <span className="block truncate font-mono text-sm">{shortId(session.id)}</span>
            <span className="mt-1 block truncate text-xs text-tertiary">{session.model}</span>
          </span>
          <span className="text-sm text-secondary">{session.association}</span>
          <span className="numeric">{session.requests} requests</span>
          <span className="numeric">{formatCompact(session.inputTokens + session.outputTokens)} tokens</span>
        </Link>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return <div className="metric"><p className="text-sm text-secondary">{label}</p><p className="mt-3 font-mono text-3xl font-medium tracking-[-0.04em]">{value}</p></div>;
}

function EvidenceRow({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }): React.JSX.Element {
  return <div className="evidence-row"><div className="mt-0.5 text-accent">{icon}</div><div className="min-w-0"><div className="flex items-baseline justify-between gap-4"><p className="text-sm text-secondary">{label}</p><p className="font-mono text-sm">{value}</p></div><p className="mt-1 text-xs leading-5 text-tertiary">{detail}</p></div></div>;
}

function SectionHeading({ title, detail }: { title: string; detail?: string }): React.JSX.Element {
  return <div className="mb-5 flex items-end justify-between gap-6"><h2 className="text-xl font-semibold tracking-[-0.025em]">{title}</h2>{detail === undefined ? null : <p className="text-xs text-tertiary">{detail}</p>}</div>;
}

function Fact({ label, value }: { label: string; value: string }): React.JSX.Element {
  return <div className="fact"><dt>{label}</dt><dd>{value}</dd></div>;
}

function DiagnosticGroup({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return <section className="diagnostic-group"><h2>{title}</h2><dl>{children}</dl></section>;
}

function ReplayColumn({ title, value }: { title: string; value: number }): React.JSX.Element {
  return <div><p className="text-sm text-secondary">{title}</p><p className="mt-3 font-mono text-2xl">{formatNumber(value)} tokens</p></div>;
}

function PolicyPreview({ name, status, explanation, limit }: { name: string; status: string; explanation: string; limit: string }): React.JSX.Element {
  return <article><div><h3>{name}</h3><span>{status}</span></div><p>{explanation}</p><code>{limit}</code></article>;
}

function BackLink(): React.JSX.Element {
  return <Link to="/" className="back-link"><ArrowLeftIcon size={15} weight="bold" />Overview</Link>;
}

function DangerButton({ label, onConfirm }: { label: string; onConfirm(): Promise<void> }): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return <button className="danger-button" type="button" onClick={() => setConfirming(true)}><TrashIcon size={16} />{label}</button>;
  }
  return (
    <div className="confirm-delete">
      <span>This cannot be undone.</span>
      <button type="button" disabled={busy} onClick={() => {
        setBusy(true);
        void onConfirm().finally(() => setBusy(false));
      }}>{busy ? "Deleting…" : "Confirm"}</button>
      <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick(): void; children: React.ReactNode }): React.JSX.Element {
  return <Tooltip.Root><Tooltip.Trigger asChild><button className="icon-button" type="button" aria-label={label} onClick={onClick}>{children}</button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip" sideOffset={8}>{label}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}

function QueryError({ error }: { error: unknown }): React.JSX.Element {
  return <AccessScreen message={error instanceof ApiError ? error.message : "The dashboard could not connect to Token Shuffle."} />;
}

function LoadingScreen({ embedded = false }: { embedded?: boolean }): React.JSX.Element {
  return <main className={embedded ? "page-shell" : "grid min-h-[100dvh] place-items-center px-5"}><div className="w-full max-w-[900px]"><div className="skeleton h-5 w-28" /><div className="skeleton mt-5 h-12 w-2/3" /><div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-4">{[0, 1, 2, 3].map((item) => <div className="skeleton h-24" key={item} />)}</div></div></main>;
}

function AccessScreen({ message }: { message: string }): React.JSX.Element {
  return <main className="grid min-h-[100dvh] place-items-center px-5"><section className="access-panel"><div className="access-icon"><LockKeyIcon size={22} weight="bold" /></div><h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">Administrative access required</h1><p className="mt-3 text-sm leading-6 text-secondary">{message}</p><div className="command-block"><code>token-shuffle open</code></div></section></main>;
}

function formatNumber(value: number): string { return new Intl.NumberFormat().format(value); }
function formatCompact(value: number): string { return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function formatDuration(value: number): string { return value >= 1_000 ? `${(value / 1_000).toFixed(1)}s` : `${Math.round(value)}ms`; }
function formatTime(value: string): string { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function shortId(value: string, length = 10): string { return value.slice(0, length); }
function humanize(value: string): string { return value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase()); }
function summarizeData(data: Record<string, boolean | number | string | null>): string {
  const entries = Object.entries(data);
  return entries.length === 0 ? "No additional fields" : entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}
