import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  ClockIcon,
  DatabaseIcon,
  InfoIcon,
  LockKeyIcon,
  SignOutIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  ApiError,
  exchangeBootstrap,
  loadOverview,
  signOut,
  type DashboardOverview,
} from "./api.js";

type BootstrapState = "checking" | "ready" | "failed";

export function App(): React.JSX.Element {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>("checking");
  const [bootstrapError, setBootstrapError] = useState<string>();
  const queryClient = useQueryClient();

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

  const overview = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: loadOverview,
    enabled: bootstrapState === "ready",
    refetchInterval: 5_000,
  });

  if (bootstrapState === "checking") return <LoadingScreen />;
  if (bootstrapState === "failed") {
    return <AccessScreen message={bootstrapError ?? "Dashboard authentication failed."} />;
  }
  if (overview.isLoading) return <LoadingScreen />;
  if (overview.isError) {
    return (
      <AccessScreen
        message={
          overview.error instanceof ApiError
            ? overview.error.message
            : "The dashboard could not connect to Token Shuffle."
        }
      />
    );
  }
  if (overview.data === undefined) return <LoadingScreen />;

  return (
    <Tooltip.Provider delayDuration={250}>
      <Dashboard
        overview={overview.data}
        refreshing={overview.isFetching}
        onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] })}
      />
    </Tooltip.Provider>
  );
}

function Dashboard({
  overview,
  refreshing,
  onRefresh,
}: {
  overview: DashboardOverview;
  refreshing: boolean;
  onRefresh(): void;
}): React.JSX.Element {
  const persistenceHealthy = !overview.system.persistence.degraded;
  return (
    <div className="min-h-[100dvh] bg-canvas text-primary">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark" aria-hidden="true">
              TS
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em]">Token Shuffle</p>
              <p className="text-xs text-secondary">Evidence dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusLabel healthy={persistenceHealthy} />
            <IconButton label="Refresh evidence" onClick={onRefresh}>
              <ArrowClockwiseIcon
                size={17}
                weight="bold"
                className={refreshing ? "motion-safe:animate-spin" : ""}
              />
            </IconButton>
            <IconButton
              label="End dashboard session"
              onClick={() => void signOut().then(() => window.location.reload())}
            >
              <SignOutIcon size={17} weight="bold" />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8 lg:py-14">
        <section className="max-w-3xl">
          <p className="text-sm font-medium text-accent">Observed locally</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            What the proxy observed.
          </h1>
          <p className="mt-4 max-w-[62ch] text-base leading-7 text-secondary">
            Token use, cache behavior, and latency remain separate so every conclusion
            stays inspectable.
          </p>
        </section>

        <section className="metric-grid mt-12" aria-label="Request summary">
          <Metric label="Completed requests" value={formatNumber(overview.summary.requests)} />
          <Metric label="Input tokens" value={formatCompact(overview.summary.inputTokens)} />
          <Metric label="Output tokens" value={formatCompact(overview.summary.outputTokens)} />
          <Metric
            label="Average latency"
            value={formatDuration(overview.summary.averageLatencyMs)}
          />
        </section>

        <div className="mt-14 grid gap-12 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
          <section>
            <SectionHeading
              title="Recent requests"
              detail={`${overview.provenance.providerReportedRequests} provider-reported, ${overview.provenance.estimatedRequests} estimated`}
            />
            <RequestTable requests={overview.recentRequests} />
          </section>

          <aside>
            <SectionHeading title="Evidence integrity" />
            <div className="integrity-panel">
              <EvidenceRow
                icon={<DatabaseIcon size={18} weight="bold" />}
                label="Persistence"
                value={persistenceHealthy ? "Healthy" : "Degraded"}
                detail={`${overview.system.persistence.droppedEvents} dropped events`}
              />
              <EvidenceRow
                icon={<CheckCircleIcon size={18} weight="bold" />}
                label="Literal reduction"
                value={formatCompact(overview.summary.literalInputTokensAvoided)}
                detail="Tokens avoided, not cache discounts"
              />
              <EvidenceRow
                icon={<ClockIcon size={18} weight="bold" />}
                label="Provider cache reads"
                value={formatCompact(overview.summary.cacheReadInputTokens)}
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
            detail={`${overview.summary.sessions} observed group${
              overview.summary.sessions === 1 ? "" : "s"
            }`}
          />
          <SessionList sessions={overview.sessions} />
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="metric">
      <p className="text-sm text-secondary">{label}</p>
      <p className="mt-3 font-mono text-3xl font-medium tracking-[-0.04em]">{value}</p>
    </div>
  );
}

function RequestTable({
  requests,
}: {
  requests: DashboardOverview["recentRequests"];
}): React.JSX.Element {
  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <DatabaseIcon size={24} weight="duotone" />
        <p className="font-medium">No completed requests yet</p>
        <p className="text-sm text-secondary">
          Send an agent request through Token Shuffle, then refresh this view.
        </p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Model</th>
            <th className="numeric">Input</th>
            <th className="numeric">Output</th>
            <th className="numeric">Latency</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>
                <p className="font-mono text-xs text-primary">{shortId(request.id)}</p>
                <p className="mt-1 text-xs text-tertiary">{formatTime(request.timestamp)}</p>
              </td>
              <td>
                <p className="max-w-[220px] truncate text-sm">{request.model}</p>
                <p className="mt-1 text-xs text-tertiary">{request.provenance}</p>
              </td>
              <td className="numeric">{formatCompact(request.inputTokens)}</td>
              <td className="numeric">{formatCompact(request.outputTokens)}</td>
              <td className="numeric">{formatDuration(request.durationMs ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionList({
  sessions,
}: {
  sessions: DashboardOverview["sessions"];
}): React.JSX.Element {
  if (sessions.length === 0) {
    return <p className="border-t border-line py-8 text-sm text-secondary">No sessions yet.</p>;
  }
  return (
    <div className="session-list">
      {sessions.map((session) => (
        <div className="session-row" key={session.id}>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm">{shortId(session.id)}</p>
            <p className="mt-1 truncate text-xs text-tertiary">{session.model}</p>
          </div>
          <p className="text-sm text-secondary">{session.association}</p>
          <p className="numeric">{session.requests} requests</p>
          <p className="numeric">{formatCompact(session.inputTokens + session.outputTokens)} tokens</p>
        </div>
      ))}
    </div>
  );
}

function EvidenceRow({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}): React.JSX.Element {
  return (
    <div className="evidence-row">
      <div className="mt-0.5 text-accent">{icon}</div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-secondary">{label}</p>
          <p className="font-mono text-sm">{value}</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-tertiary">{detail}</p>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}): React.JSX.Element {
  return (
    <div className="mb-5 flex items-end justify-between gap-6">
      <h2 className="text-xl font-semibold tracking-[-0.025em]">{title}</h2>
      {detail === undefined ? null : <p className="text-xs text-tertiary">{detail}</p>}
    </div>
  );
}

function StatusLabel({ healthy }: { healthy: boolean }): React.JSX.Element {
  return (
    <div className="status-label" aria-label={healthy ? "Persistence healthy" : "Persistence degraded"}>
      {healthy ? (
        <CheckCircleIcon size={15} weight="fill" />
      ) : (
        <WarningCircleIcon size={15} weight="fill" />
      )}
      <span>{healthy ? "Healthy" : "Degraded"}</span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className="icon-button" type="button" aria-label={label} onClick={onClick}>
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function LoadingScreen(): React.JSX.Element {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-canvas px-6 text-primary">
      <div className="w-full max-w-md">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton mt-6 h-10 w-full" />
        <div className="skeleton mt-3 h-10 w-4/5" />
        <div className="mt-10 grid grid-cols-2 gap-4">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      </div>
    </main>
  );
}

function AccessScreen({ message }: { message: string }): React.JSX.Element {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-canvas px-6 text-primary">
      <div className="access-panel">
        <div className="access-icon">
          <LockKeyIcon size={24} weight="duotone" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.035em]">
          Administrative session required
        </h1>
        <p className="mt-3 text-sm leading-6 text-secondary">{message}</p>
        <div className="command-block">
          <InfoIcon size={16} weight="bold" />
          <code>token-shuffle open</code>
        </div>
      </div>
    </main>
  );
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 0 : 1)} s`;
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
