import { useMemo, useState, type FormEvent } from "react";
import {
  api,
  type Attention,
  type Experiment,
  type OperatorState,
  type RecoveryCase,
  type TrialDetail,
  type TrialSummary,
} from "./api";
import {
  LoadingPanel,
  Notice,
  PageHeader,
  ReadFailure,
  StatusBadge,
} from "./components";
import {
  formatDuration,
  formatTimestamp,
  readableStatus,
  statusTone,
} from "./format";
import { useResource } from "./hooks/use-resource";

function pageQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function pagePath(pathname: string, query: URLSearchParams): string {
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function SystemPage({ state }: { state: OperatorState | null }) {
  if (!state) {
    return <LoadingPanel label="Reading the latest operator state…" />;
  }
  const evidence = state.evidence;
  const healthLabel =
    evidence?.freshness === "fresh" ? evidence.overallState : "unknown";
  const stateLabel =
    healthLabel === "unknown"
      ? "Current health unknown"
      : readableStatus(healthLabel);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="System"
        description="Current deterministic evidence, monitor context and controlled-run readiness for the local testbed."
        actions={
          <a
            className="primary-action inline-flex items-center px-4 text-sm/5 no-underline"
            href="/controlled-test"
          >
            New controlled test
          </a>
        }
      />
      {state.controlPlane.status === "unavailable" ? (
        <Notice title="Connection unavailable" tone="warning">
          <p>
            {state.controlPlane.message ??
              "The last received evidence is historical. Current health and write readiness are unknown."}
          </p>
        </Notice>
      ) : null}
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm/5 font-medium text-muted">
              Deterministic evidence
            </p>
            <h2 className="mt-1 text-balance text-[1.25rem]/7 font-semibold text-ink">
              {evidence?.summary ?? "No evidence snapshot is recorded"}
            </h2>
            <p className="mt-2 text-base/6 text-muted">
              {evidence
                ? `${evidence.freshness === "fresh" ? "Observed" : "Last observed"} ${formatTimestamp(evidence.observedAt, true)}`
                : "Monitor observations will appear after the control plane records them."}
            </p>
          </div>
          <StatusBadge tone={statusTone(healthLabel)}>{stateLabel}</StatusBadge>
        </div>
        {evidence ? (
          <dl className="mt-5 grid @container sm:grid-cols-2 lg:grid-cols-3">
            {evidence.signals.map((signal, index) => (
              <div
                key={signal.code}
                className={`min-w-0 py-4 sm:px-4 sm:py-0 ${index % 2 === 1 ? "sm:border-l sm:border-border" : ""} ${index > 1 ? "border-t border-border sm:border-t-0" : ""} lg:[&:nth-child(3n+1)]:pl-0 lg:[&:not(:nth-child(3n+1))]:border-l lg:[&:not(:nth-child(3n+1))]:border-border`}
              >
                <dt className="text-sm/5 font-medium text-muted">
                  {signal.label}
                </dt>
                <dd className="mt-2 flex flex-wrap items-center gap-2 text-base/6 text-ink">
                  <span>{signal.value ?? "Not recorded"}</span>
                  <StatusBadge tone={statusTone(signal.status)}>
                    {readableStatus(signal.status)}
                  </StatusBadge>
                </dd>
                <p className="mt-2 text-sm/5 text-muted">
                  {signal.description}
                </p>
              </div>
            ))}
          </dl>
        ) : null}
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="panel p-5 sm:p-6">
          <h2 className="text-[1.25rem]/7 font-semibold">
            Monitoring & recovery
          </h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm/5 font-medium text-muted">
                Monitor state
              </dt>
              <dd className="mt-1 text-base/6 text-ink">
                {readableStatus(state.monitor.state)}
              </dd>
            </div>
            <div>
              <dt className="text-sm/5 font-medium text-muted">Heartbeat</dt>
              <dd className="mt-1 text-base/6 text-ink">
                {formatTimestamp(state.monitor.heartbeatAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm/5 font-medium text-muted">
                Active strategy
              </dt>
              <dd className="mt-1 text-base/6 text-ink">
                {state.monitor.strategy
                  ? `${state.monitor.strategy.label} · ${state.monitor.strategy.reuseEnabled ? "reuse on" : "reuse off"}`
                  : "Unconfirmed"}
              </dd>
            </div>
            <div>
              <dt className="text-sm/5 font-medium text-muted">Current run</dt>
              <dd className="mt-1 text-base/6 text-ink">
                {state.monitor.activeRunId ?? "No controlled run in progress"}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-panel border border-primary/20 bg-primary-soft p-5">
          <h2 className="text-base/6 font-semibold text-primary">
            Launch readiness
          </h2>
          <p className="mt-2 text-base/6 text-ink">
            {state.monitor.readiness.canLaunch
              ? "The server will still recheck readiness and the shared lock when a test starts."
              : "A new controlled test is currently unavailable."}
          </p>
          {state.monitor.readiness.reasons.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm/5 text-muted">
              {state.monitor.readiness.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          <a
            className="secondary-action mt-4 inline-flex items-center px-3 text-sm/5 no-underline"
            href="/controlled-test"
          >
            Review a controlled test
          </a>
        </section>
      </div>
    </div>
  );
}

function TrialRows({ records }: { records: TrialSummary[] }) {
  const query = pageQuery();
  return (
    <div className="-mx-5 -my-2 overflow-x-auto whitespace-nowrap sm:-mx-6 lg:mx-0">
      <div className="inline-block min-w-full px-5 py-2 align-middle sm:px-6 lg:px-0">
        <table className="trial-table w-full text-left">
          <thead className="text-sm/5 text-muted">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-medium">
                Trial / time
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">
                Trigger & scenario
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">
                Strategy
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">
                Runtime outcome
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">
                Verification
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((record) => {
              const detailQuery = new URLSearchParams(query);
              detailQuery.set("trial", record.id);
              return (
                <tr key={record.id} className="align-top">
                  <td data-label="Trial / time" className="px-4 py-4">
                    <a
                      className="font-mono text-sm/5 font-medium text-primary underline decoration-primary/30 underline-offset-4"
                      href={pagePath("/trials", detailQuery)}
                      translate="no"
                    >
                      {record.id}
                    </a>
                    <p className="mt-1 whitespace-normal text-sm/5 text-muted">
                      {formatTimestamp(record.startedAt, true)}
                    </p>
                  </td>
                  <td
                    data-label="Trigger & scenario"
                    className="px-4 py-4 whitespace-normal text-base/6 text-ink"
                  >
                    {record.trigger} ·{" "}
                    {record.scenario ?? "Scenario not recorded"}
                  </td>
                  <td
                    data-label="Strategy"
                    className="px-4 py-4 whitespace-normal text-base/6 text-ink"
                  >
                    {record.strategy}
                  </td>
                  <td data-label="Runtime outcome" className="px-4 py-4">
                    <StatusBadge tone={statusTone(record.outcome)}>
                      {readableStatus(record.outcome)}
                    </StatusBadge>
                  </td>
                  <td data-label="Verification" className="px-4 py-4">
                    <StatusBadge tone={statusTone(record.oracle)}>
                      {readableStatus(record.oracle)}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TrialsPage() {
  const query = useMemo(pageQuery, []);
  const selectedId = query.get("trial");
  const [search, setSearch] = useState(query.get("search") ?? "");
  const list = useResource(
    (signal) => api.listTrials(pageQuery(), signal),
    [window.location.search],
    { pollMs: 10_000 },
  );
  const runId = query.get("run");
  const run = useResource(
    (signal) =>
      runId?.startsWith("operator-run-")
        ? api.getControlledRun(runId, signal)
        : Promise.resolve(null),
    [runId],
    { pollMs: 10_000 },
  );
  const detail = useResource(
    (signal) =>
      selectedId ? api.getTrial(selectedId, signal) : Promise.resolve(null),
    [selectedId],
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const updated = pageQuery();
    if (search.trim()) updated.set("search", search.trim());
    else updated.delete("search");
    updated.delete("trial");
    window.location.assign(pagePath("/trials", updated));
  };
  if (list.loading && !list.data)
    return <LoadingPanel label="Reading recorded trial history…" />;
  if (list.error && !list.data)
    return (
      <ReadFailure
        message={list.error.message}
        correlationId={list.error.correlationId}
        onRetry={list.refresh}
      />
    );
  const records = list.data?.records ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trials"
        description="Recorded recovery attempts. Historical outcome, current health and human review remain separate facts."
        actions={
          <a
            className="secondary-action inline-flex items-center px-3 text-sm/5 no-underline"
            href="/controlled-test"
          >
            New controlled test
          </a>
        }
      />
      {run.data ? (
        <Notice
          title="Controlled test progress"
          tone={
            run.data.failed || run.data.restoration === "failed"
              ? "danger"
              : "primary"
          }
        >
          <p>
            Run: {readableStatus(run.data.status)} · restoration:{" "}
            {run.data.restoration} · shared lock:{" "}
            {run.data.lockHeld ? "held" : "released"}.
          </p>
          {run.data.trialId ? (
            <a
              className="inline-flex min-h-11 items-center break-all text-primary underline"
              href={`/trials?trial=${encodeURIComponent(run.data.trialId)}`}
            >
              Inspect the linked trial
            </a>
          ) : (
            <p>
              Waiting for a completed monitor trial. This view refreshes
              automatically.
            </p>
          )}
        </Notice>
      ) : null}
      {run.error ? (
        <ReadFailure
          message={run.error.message}
          correlationId={run.error.correlationId}
          onRetry={run.refresh}
        />
      ) : null}
      {list.error ? (
        <ReadFailure
          message={list.error.message}
          correlationId={list.error.correlationId}
          onRetry={list.refresh}
        />
      ) : null}
      <section className="panel p-5 sm:p-6">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <div className="min-w-0 flex-1">
            <label
              className="text-sm/5 font-medium text-muted"
              htmlFor="trial-search"
            >
              Search trial or run
            </label>
            <input
              className="control mt-1 w-full px-3 text-base/6 sm:text-sm/5"
              id="trial-search"
              name="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Trial ID, run ID or scenario…"
              autoComplete="off"
            />
          </div>
          <button
            className="secondary-action self-end px-3 text-sm/5"
            type="submit"
          >
            Apply filters
          </button>
        </form>
        {records.length > 0 ? (
          <div className="mt-5">
            <TrialRows records={records} />
          </div>
        ) : (
          <div className="mt-5 border-t border-border pt-5">
            <h2 className="text-base/6 font-semibold">
              {search ? "No trials match these filters" : "No trials recorded"}
            </h2>
            <p className="mt-2 text-base/6 text-muted">
              {search
                ? "Existing trials remain unchanged. Clear the search to see all recorded evidence."
                : "A controlled local test creates inspectable trial evidence."}
            </p>
            {search ? (
              <a
                className="secondary-action mt-4 inline-flex items-center px-3 text-sm/5 no-underline"
                href="/trials"
              >
                Clear filters
              </a>
            ) : (
              <a
                className="secondary-action mt-4 inline-flex items-center px-3 text-sm/5 no-underline"
                href="/controlled-test"
              >
                Configure a controlled test
              </a>
            )}
          </div>
        )}
      </section>
      {selectedId && detail.data ? (
        <TrialInvestigation trial={detail.data} />
      ) : null}
      {list.data?.nextCursor ? (
        <a
          className="secondary-action inline-flex min-h-11 items-center self-start px-3 text-sm/5 no-underline"
          href={pagePath(
            "/trials",
            new URLSearchParams({
              ...Object.fromEntries(query),
              cursor: list.data.nextCursor,
            }),
          )}
        >
          Older trials
        </a>
      ) : null}
      {selectedId && detail.loading ? (
        <LoadingPanel label="Reading the selected recovery trail…" />
      ) : null}
      {selectedId && detail.error ? (
        <ReadFailure
          message={detail.error.message}
          correlationId={detail.error.correlationId}
          onRetry={detail.refresh}
        />
      ) : null}
    </div>
  );
}

function TrialInvestigation({ trial }: { trial: TrialDetail }) {
  const [selectedTrailId, setSelectedTrailId] = useState(
    trial.trail[0]?.id ?? null,
  );
  const selected =
    trial.trail.find((entry) => entry.id === selectedTrailId) ?? trial.trail[0];
  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm/5 font-medium text-muted">
            Trial investigation
          </p>
          <h2 className="mt-1 text-[1.25rem]/7 font-semibold" translate="no">
            {trial.trial.id}
          </h2>
          <p className="mt-2 text-base/6 text-muted">
            Runtime: {readableStatus(trial.trial.outcome)} · Oracle:{" "}
            {readableStatus(trial.trial.oracle)} · Restoration:{" "}
            {readableStatus(trial.trial.restoration)}
          </p>
        </div>
        <a
          className="secondary-action inline-flex items-center px-3 text-sm/5 no-underline"
          href="/trials"
        >
          Back to trials
        </a>
      </div>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(22rem,27.5rem)_minmax(0,1fr)]">
        <ol
          className="min-w-0 divide-y divide-border"
          role="list"
          aria-label="Recorded recovery trail"
        >
          {trial.trail.map((entry, index) => (
            <li key={entry.id}>
              <button
                className={`flex min-h-16 w-full items-start gap-3 px-1 py-3 text-left ${selected?.id === entry.id ? "bg-primary-soft" : ""}`}
                type="button"
                onClick={() => setSelectedTrailId(entry.id)}
                aria-pressed={selected?.id === entry.id}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas font-mono text-sm/5 text-muted tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <span className="text-base/6 font-medium text-ink">
                    {entry.label}
                  </span>
                  <span className="mt-1 block whitespace-normal text-sm/5 text-muted">
                    {entry.summary}
                  </span>
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-sm/5 text-muted tabular-nums">
                  {formatTimestamp(entry.occurredAt)}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {selected ? (
          <article className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm/5 text-muted" translate="no">
                  {selected.id}
                </p>
                <h3 className="mt-1 text-[1.25rem]/7 font-semibold">
                  {selected.label}
                </h3>
              </div>
              <StatusBadge tone={statusTone(selected.status)}>
                {readableStatus(selected.status)}
              </StatusBadge>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm/5 font-medium text-muted">
                  Recorded reason
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-base/6 text-ink">
                  {selected.detail.reason ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-sm/5 font-medium text-muted">Evidence</dt>
                <dd
                  className="mt-1 break-words font-mono text-sm/5 text-ink"
                  translate="no"
                >
                  {selected.detail.beforeEvidenceId ?? "Not recorded"} →{" "}
                  {selected.detail.afterEvidenceId ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-sm/5 font-medium text-muted">
                  Safety rules
                </dt>
                <dd className="mt-1 break-words text-base/6 text-ink">
                  {selected.detail.failedSafetyRuleIds.length > 0
                    ? selected.detail.failedSafetyRuleIds.join(", ")
                    : "No failed rule IDs recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-sm/5 font-medium text-muted">
                  Plan provenance
                </dt>
                <dd
                  className="mt-1 break-words font-mono text-sm/5 text-ink"
                  translate="no"
                >
                  {selected.detail.planOrigin ?? "Origin not recorded"} ·{" "}
                  {selected.detail.sourceTrialId ??
                    "No historical source trial"}{" "}
                  {selected.detail.sourcePlanId
                    ? `→ ${selected.detail.sourcePlanId}`
                    : ""}
                </dd>
              </div>
            </dl>
            <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
              <p className="text-sm/5 text-muted">
                Runtime observed healing:{" "}
                <span className="font-mono text-ink tabular-nums">
                  {formatDuration(trial.measurement.observedTimeToHealMs)}
                </span>
              </p>
              <p className="text-sm/5 text-muted">
                Independent healing:{" "}
                <span className="font-mono text-ink tabular-nums">
                  {formatDuration(trial.measurement.timeToHealMs)}
                </span>
              </p>
              <p className="text-sm/5 text-muted">
                Fault to detection:{" "}
                <span className="font-mono text-ink tabular-nums">
                  {formatDuration(trial.measurement.faultToDetectionMs)}
                </span>
              </p>
              <p className="text-sm/5 text-muted">
                Termination:{" "}
                <span className="font-mono text-ink tabular-nums">
                  {formatDuration(trial.measurement.timeToTerminationMs)}
                </span>
              </p>
            </div>
          </article>
        ) : (
          <p className="text-base/6 text-muted">
            No chronological records were stored for this trial.
          </p>
        )}
      </div>
    </section>
  );
}

function AttentionRow({ attention }: { attention: Attention }) {
  const query = new URLSearchParams();
  query.set("attention", attention.id);
  return (
    <li className="flex flex-col gap-3 border-t border-border py-4 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <a
          className="font-mono text-sm/5 font-medium text-primary underline decoration-primary/30 underline-offset-4"
          href={pagePath("/attention", query)}
          translate="no"
        >
          {attention.id}
        </a>
        <p className="mt-2 max-w-[72ch] break-words text-base/6 text-ink">
          {attention.reason}
        </p>
        <p className="mt-2 text-sm/5 text-muted">
          Created {formatTimestamp(attention.createdAt, true)} · trial{" "}
          <span className="font-mono" translate="no">
            {attention.trialId}
          </span>
        </p>
      </div>
      <StatusBadge tone={statusTone(attention.state)}>
        {readableStatus(attention.state)}
      </StatusBadge>
    </li>
  );
}

export function AttentionPage() {
  const query = useMemo(pageQuery, []);
  const selectedId = query.get("attention");
  const list = useResource((signal) => api.listAttention(signal), [], {
    pollMs: 10_000,
  });
  const detail = useResource(
    (signal) =>
      selectedId ? api.getAttention(selectedId, signal) : Promise.resolve(null),
    [selectedId],
    { pollMs: 10_000 },
  );
  if (list.loading && !list.data)
    return <LoadingPanel label="Reading durable attention records…" />;
  if (list.error && !list.data)
    return (
      <ReadFailure
        message={list.error.message}
        correlationId={list.error.correlationId}
        onRetry={list.refresh}
      />
    );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attention"
        description="Historical escalations requiring human review. Reviewing a record never resumes recovery or releases an operational hold."
      />
      {list.error ? (
        <ReadFailure
          message={list.error.message}
          correlationId={list.error.correlationId}
          onRetry={list.refresh}
        />
      ) : null}
      <section className="panel p-5 sm:p-6">
        {list.data?.length ? (
          <ul role="list">
            {list.data.map((attention) => (
              <AttentionRow key={attention.id} attention={attention} />
            ))}
          </ul>
        ) : (
          <>
            <h2 className="text-base/6 font-semibold">No attention records</h2>
            <p className="mt-2 text-base/6 text-muted">
              A durable record appears only when a recovery run escalates for
              human review.
            </p>
          </>
        )}
      </section>
      {selectedId && detail.data ? (
        <AttentionDetailPage detail={detail.data} refresh={detail.refresh} />
      ) : null}
      {selectedId && detail.loading ? (
        <LoadingPanel label="Reading the selected escalation…" />
      ) : null}
      {selectedId && detail.error ? (
        <ReadFailure
          message={detail.error.message}
          correlationId={detail.error.correlationId}
          onRetry={detail.refresh}
        />
      ) : null}
    </div>
  );
}

function AttentionDetailPage({
  detail,
  refresh,
}: {
  detail: import("./api").AttentionDetail;
  refresh: () => Promise<void>;
}) {
  const [notes, setNotes] = useState(detail.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"acknowledge" | "review" | null>(null);
  const acknowledge = async () => {
    setError(null);
    setPending("acknowledge");
    try {
      await api.acknowledgeAttention(detail.id);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Acknowledgement could not be recorded.",
      );
    } finally {
      setPending(null);
    }
  };
  const review = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!notes.trim()) {
      setError("Review notes are required.");
      return;
    }
    setPending("review");
    try {
      await api.reviewAttention(detail.id, notes);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Review could not be recorded. Your draft remains available.",
      );
    } finally {
      setPending(null);
    }
  };
  const canReview = detail.state === "acknowledged";
  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm/5 text-muted" translate="no">
            {detail.id}
          </p>
          <h2 className="mt-1 text-[1.25rem]/7 font-semibold">
            Historical escalation
          </h2>
        </div>
        <StatusBadge tone={statusTone(detail.state)}>
          {readableStatus(detail.state)}
        </StatusBadge>
      </div>
      <p className="mt-5 max-w-[80ch] break-words text-base/6 text-ink">
        {detail.reason}
      </p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm/5 font-medium text-muted">Trial outcome</dt>
          <dd className="mt-1 text-base/6 text-ink">
            {readableStatus(detail.trialOutcome)}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">Current health</dt>
          <dd className="mt-1 text-base/6 text-ink">
            {readableStatus(detail.currentHealth)}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">Acknowledged</dt>
          <dd className="mt-1 text-base/6 text-ink">
            {formatTimestamp(detail.acknowledgedAt, true)}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">Review completed</dt>
          <dd className="mt-1 text-base/6 text-ink">
            {formatTimestamp(detail.reviewedAt, true)}
          </dd>
        </div>
      </dl>
      {detail.state === "requires_attention" ? (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-base/6 text-muted">
            Acknowledgement records that this handoff has been seen. It does not
            change the trial or execute an action.
          </p>
          <button
            className="secondary-action mt-4 px-3 text-sm/5"
            type="button"
            disabled={pending !== null}
            onClick={() => void acknowledge()}
          >
            {pending === "acknowledge"
              ? "Acknowledging…"
              : "Acknowledge escalation"}
          </button>
        </div>
      ) : null}
      <form className="mt-6 border-t border-border pt-5" onSubmit={review}>
        <label
          className="text-sm/5 font-medium text-muted"
          htmlFor="review-notes"
        >
          Review notes
        </label>
        <textarea
          className="control mt-2 min-h-32 w-full px-3 py-2 text-base/6 outline-offset-0 sm:text-sm/5"
          id="review-notes"
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={4000}
          disabled={!canReview || pending !== null}
          aria-invalid={error === "Review notes are required."}
          aria-describedby="review-notes-help review-notes-error"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm/5 text-muted" id="review-notes-help">
            {canReview
              ? "Record a bounded human review. It does not heal, approve, resume or release a hold."
              : "Acknowledge this escalation before recording review notes."}
          </p>
          <span className="font-mono text-sm/5 text-muted tabular-nums">
            {notes.length}/4000
          </span>
        </div>
        {error ? (
          <p
            className="mt-3 text-sm/5 text-danger"
            id="review-notes-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          className="secondary-action mt-4 px-3 text-sm/5"
          type="submit"
          disabled={!canReview || pending !== null}
        >
          {pending === "review" ? "Saving…" : "Record review"}
        </button>
      </form>
    </section>
  );
}

function ExperimentRows({ experiments }: { experiments: Experiment[] }) {
  return (
    <ul role="list">
      {experiments.map((experiment) => (
        <li
          key={experiment.id}
          className="flex flex-col gap-3 border-t border-border py-4 first:border-t-0 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <a
              className="text-base/6 font-semibold text-primary underline decoration-primary/30 underline-offset-4"
              href={`/experiments?batch=${encodeURIComponent(experiment.id)}`}
            >
              {experiment.name}
            </a>
            <p className="mt-2 text-sm/5 text-muted">
              {formatTimestamp(experiment.createdAt, true)} ·{" "}
              {experiment.attemptedRuns} attempted ·{" "}
              {experiment.validRuns === null
                ? "validity not recorded"
                : `${experiment.validRuns} valid`}
            </p>
          </div>
          <StatusBadge tone={statusTone(experiment.status)}>
            {readableStatus(experiment.status)}
          </StatusBadge>
        </li>
      ))}
    </ul>
  );
}

export function ExperimentsPage() {
  const selectedId = pageQuery().get("batch");
  const list = useResource((signal) => api.listExperiments(signal), []);
  const detail = useResource(
    (signal) =>
      selectedId
        ? api.getExperiment(selectedId, signal)
        : Promise.resolve(null),
    [selectedId],
  );
  if (list.loading && !list.data)
    return (
      <LoadingPanel label="Reading persisted experiments and archived campaigns…" />
    );
  if (list.error && !list.data)
    return (
      <ReadFailure
        message={list.error.message}
        correlationId={list.error.correlationId}
        onRetry={list.refresh}
      />
    );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Experiments"
        description="Persisted batches, frozen configuration and validated archived evidence. Prepared panels remain not run until evidence exists."
      />
      {list.error ? (
        <ReadFailure
          message={list.error.message}
          correlationId={list.error.correlationId}
          onRetry={list.refresh}
        />
      ) : null}
      <section className="panel p-5 sm:p-6">
        {list.data?.length ? (
          <ExperimentRows experiments={list.data} />
        ) : (
          <>
            <h2 className="text-base/6 font-semibold">
              No persisted experiment batches
            </h2>
            <p className="mt-2 text-base/6 text-muted">
              Prepared protocols can be inspected separately. No result is
              implied until a batch has recorded evidence.
            </p>
          </>
        )}
      </section>
      {selectedId && detail.data ? (
        <ExperimentDetailPage detail={detail.data} />
      ) : null}
      {selectedId && detail.loading ? (
        <LoadingPanel label="Reading frozen configuration and linked runs…" />
      ) : null}
      {selectedId && detail.error ? (
        <ReadFailure
          message={detail.error.message}
          correlationId={detail.error.correlationId}
          onRetry={detail.refresh}
        />
      ) : null}
    </div>
  );
}

function ExperimentDetailPage({
  detail,
}: {
  detail: import("./api").ExperimentDetail;
}) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:justify-between">
        <div>
          <p className="font-mono text-sm/5 text-muted" translate="no">
            {detail.id}
          </p>
          <h2 className="mt-1 text-[1.25rem]/7 font-semibold">{detail.name}</h2>
        </div>
        <a
          className="secondary-action inline-flex items-center px-3 text-sm/5 no-underline"
          href="/experiments"
        >
          Back to experiments
        </a>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <h3 className="text-base/6 font-semibold">Constituent runs</h3>
          {detail.runs.length ? (
            <ul className="mt-3 divide-y divide-border" role="list">
              {detail.runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-sm/5 text-ink" translate="no">
                      {run.id}
                    </p>
                    <p className="mt-1 text-sm/5 text-muted">
                      {run.strategy} · {run.profile} · repetition{" "}
                      {run.repetition} · trial {run.trialId ?? "not linked"}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(run.oracle)}>
                    {readableStatus(run.oracle)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-base/6 text-muted">
              Not run. There are no constituent records to show.
            </p>
          )}
        </div>
        <div className="rounded-panel border border-border bg-canvas p-4">
          <h3 className="text-base/6 font-semibold">Frozen configuration</h3>
          <dl className="mt-3 space-y-3">
            {Object.entries(detail.configuration).map(([key, value]) => (
              <div key={key}>
                <dt
                  className="break-words font-mono text-sm/5 text-muted"
                  translate="no"
                >
                  {key}
                </dt>
                <dd className="mt-1 break-words text-sm/5 text-ink">
                  {typeof value === "string" ||
                  typeof value === "number" ||
                  typeof value === "boolean"
                    ? String(value)
                    : "Structured value recorded"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export function RecoveryCasesPage() {
  const selectedPlanId = pageQuery().get("plan");
  const list = useResource((signal) => api.listRecoveryCases(signal), []);
  const detail = useResource(
    (signal) =>
      selectedPlanId
        ? api.getRecoveryCase(selectedPlanId, signal)
        : Promise.resolve(null),
    [selectedPlanId],
  );
  if (list.loading && !list.data)
    return <LoadingPanel label="Reading eligible recovery source plans…" />;
  if (list.error && !list.data)
    return (
      <ReadFailure
        message={list.error.message}
        correlationId={list.error.correlationId}
        onRetry={list.refresh}
      />
    );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recovery cases"
        description="Read-only verified source plans. Historical lookup and adoption stay deterministic, bounded and independent of browser edits."
      />
      {list.error ? (
        <ReadFailure
          message={list.error.message}
          correlationId={list.error.correlationId}
          onRetry={list.refresh}
        />
      ) : null}
      <section className="panel p-5 sm:p-6">
        {list.data?.length ? (
          <ul role="list">
            {list.data.map((entry) => (
              <RecoveryCaseRow key={entry.sourcePlanId} entry={entry} />
            ))}
          </ul>
        ) : (
          <>
            <h2 className="text-base/6 font-semibold">
              No eligible recovery cases
            </h2>
            <p className="mt-2 text-base/6 text-muted">
              A source plan is published only after existing eligibility and
              verification checks succeed.
            </p>
          </>
        )}
      </section>
      {selectedPlanId && detail.data ? (
        <RecoveryCaseDetail entry={detail.data} />
      ) : null}
      {selectedPlanId && detail.loading ? (
        <LoadingPanel label="Reading source-plan provenance…" />
      ) : null}
      {selectedPlanId && detail.error ? (
        <ReadFailure
          message={detail.error.message}
          correlationId={detail.error.correlationId}
          onRetry={detail.refresh}
        />
      ) : null}
    </div>
  );
}

function RecoveryCaseRow({ entry }: { entry: RecoveryCase }) {
  return (
    <li className="flex flex-col gap-3 border-t border-border py-4 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <a
          className="font-mono text-sm/5 font-medium text-primary underline decoration-primary/30 underline-offset-4"
          href={`/recovery-cases?plan=${encodeURIComponent(entry.sourcePlanId)}`}
          translate="no"
        >
          {entry.sourcePlanId}
        </a>
        <p className="mt-2 text-base/6 text-ink">{entry.incident}</p>
        <p className="mt-2 text-sm/5 text-muted">
          Source trial{" "}
          <span className="font-mono" translate="no">
            {entry.sourceTrialId}
          </span>{" "}
          · published {formatTimestamp(entry.publishedAt, true)}
        </p>
      </div>
      <StatusBadge tone={statusTone(entry.oracle)}>
        {entry.oracle === "passed" ? "Verified" : "Verification unavailable"}
      </StatusBadge>
    </li>
  );
}
function RecoveryCaseDetail({ entry }: { entry: RecoveryCase }) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm/5 text-muted" translate="no">
            {entry.sourcePlanId}
          </p>
          <h2 className="mt-1 text-[1.25rem]/7 font-semibold">
            Verified source plan
          </h2>
        </div>
        <a
          className="secondary-action inline-flex items-center px-3 text-sm/5 no-underline"
          href="/recovery-cases"
        >
          Back to recovery cases
        </a>
      </div>
      <dl className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <dt className="text-sm/5 font-medium text-muted">Source trial</dt>
          <dd className="mt-1 font-mono text-base/6 text-ink" translate="no">
            {entry.sourceTrialId}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">
            Exact registered actions
          </dt>
          <dd className="mt-1 text-base/6 text-ink">
            {entry.actions.join(" → ") || "No registered actions"}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">Rationale</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-base/6 text-ink">
            {entry.rationale}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">Expected outcome</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-base/6 text-ink">
            {entry.expectedOutcome}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">Compatibility</dt>
          <dd
            className="mt-1 break-all font-mono text-sm/5 text-ink"
            translate="no"
          >
            {entry.compatibilityFingerprint}
          </dd>
        </div>
        <div>
          <dt className="text-sm/5 font-medium text-muted">
            Frozen source IDs
          </dt>
          <dd
            className="mt-1 break-words font-mono text-sm/5 text-ink"
            translate="no"
          >
            {entry.corpusSourceIds.join(", ") || "[]"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ControlledTestPage({ state }: { state: OperatorState | null }) {
  const query = pageQuery();
  const stage = query.get("stage") === "review" ? "review" : "configure";
  const [profile, setProfile] = useState(
    query.get("profile") ?? "managed_system_application_stopped",
  );
  const [strategy, setStrategy] = useState(query.get("strategy") ?? "v2");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!state)
    return <LoadingPanel label="Checking controlled-test readiness…" />;
  const selectedStrategy = state.strategies.find(
    (entry) => entry.id === strategy,
  );
  const toReview = () => {
    const next = new URLSearchParams({ stage: "review", profile, strategy });
    window.location.assign(pagePath("/controlled-test", next));
  };
  const requestKey = `operator-launch:${profile}:${strategy}`;
  const priorRequestId = sessionStorage.getItem(requestKey);
  const launch = async () => {
    setPending(true);
    setError(null);
    const requestId = priorRequestId ?? crypto.randomUUID();
    sessionStorage.setItem(requestKey, requestId);
    try {
      const response = await api.launchControlledTest({
        requestId,
        profile,
        strategy,
        workload: "idle",
      });
      sessionStorage.removeItem(requestKey);
      window.location.assign(
        `/trials?run=${encodeURIComponent(response.runId)}`,
      );
    } catch {
      setError(
        "Acceptance could not be confirmed. Retry reconciles this same request; do not start a different test until the shared lock is clear.",
      );
    } finally {
      setPending(false);
    }
  };
  if (stage === "configure")
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="New controlled test"
          description="Settings apply only to the next bounded local run. The browser cannot choose commands, targets, models or recovery actions."
          actions={
            <a
              className="secondary-action inline-flex items-center px-3 text-sm/5 no-underline"
              href="/"
            >
              Back to system
            </a>
          }
        />
        <section className="panel p-5 sm:p-6">
          <fieldset>
            <legend className="text-base/6 font-semibold">Scenario</legend>
            <div className="mt-4 grid gap-3">
              {[
                {
                  id: "managed_system_application_stopped",
                  label: "Application stopped",
                  description:
                    "Stops the managed application container; recovery must re-establish reachability.",
                },
                {
                  id: "managed_system_postgres_stopped",
                  label: "PostgreSQL stopped",
                  description:
                    "Stops the managed application database; database-backed routes may fail.",
                },
                {
                  id: "managed_system_application_and_postgres_stopped",
                  label: "Application + PostgreSQL stopped",
                  description: "Stops both registered managed targets.",
                },
                {
                  id: "managed_system_application_network_isolated",
                  label: "Application network isolation",
                  description:
                    "Uses the validated Milestone 9 isolation and restoration path; expected safe escalation.",
                },
              ].map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer gap-3 rounded-panel border p-4 ${profile === option.id ? "border-primary bg-primary-soft" : "border-border"}`}
                >
                  <input
                    className="mt-1 size-5 shrink-0 accent-primary sm:size-4"
                    type="radio"
                    name="profile"
                    value={option.id}
                    checked={profile === option.id}
                    onChange={() => setProfile(option.id)}
                  />
                  <span>
                    <span className="text-base/6 font-medium text-ink">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-sm/5 text-muted">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-6 border-t border-border pt-6">
            <legend className="text-base/6 font-semibold">
              Recovery strategy
            </legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {state.strategies.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer gap-3 rounded-panel border p-4 ${strategy === option.id ? "border-primary bg-primary-soft" : "border-border"} ${!option.ready ? "opacity-65" : ""}`}
                >
                  <input
                    className="mt-1 size-5 shrink-0 accent-primary sm:size-4"
                    type="radio"
                    name="strategy"
                    value={option.id}
                    checked={strategy === option.id}
                    onChange={() => setStrategy(option.id)}
                    disabled={!option.ready}
                  />
                  <span>
                    <span className="text-base/6 font-medium text-ink">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-sm/5 text-muted">
                      {option.reuseEnabled
                        ? "Historical reuse uses server-owned, frozen eligible sources only."
                        : "Historical reuse is off."}
                      {option.reason ? ` ${option.reason}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <section className="mt-6 rounded-panel border border-border bg-canvas p-4">
            <h2 className="text-base/6 font-semibold">Next run</h2>
            <p className="mt-2 text-base/6 text-muted">
              {selectedStrategy?.label ?? "Strategy unavailable"} · one
              repetition · idle workload · maximum{" "}
              {selectedStrategy?.maxActions ?? 3} action invocations · maximum{" "}
              {selectedStrategy?.maxTurns ?? 8} model turns.
            </p>
          </section>
          <button
            className="primary-action mt-6 px-4 text-sm/5"
            type="button"
            onClick={toReview}
            disabled={!selectedStrategy?.ready}
          >
            Review test
          </button>
        </section>
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review controlled test"
        description="This test will interrupt the local managed application. Server preflight and the shared lock are rechecked at launch."
        actions={
          <a
            className="secondary-action inline-flex items-center px-3 text-sm/5 no-underline"
            href={`/controlled-test?profile=${encodeURIComponent(profile)}&strategy=${encodeURIComponent(strategy)}`}
          >
            Change test
          </a>
        }
      />
      <section className="panel p-5 sm:p-6">
        <div className="rounded-panel border border-warning/25 bg-warning-soft p-4">
          <h2 className="text-base/6 font-semibold text-warning">
            This test disrupts the managed local application
          </h2>
          <p className="mt-2 text-base/6 text-ink">
            Target: managed-system. Application requests may fail during this
            run. No cancellation or emergency-stop operation is available.
            Restoration is attempted and verified, not guaranteed.
          </p>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm/5 font-medium text-muted">Scenario</dt>
            <dd className="mt-1 text-base/6 text-ink">
              {profile.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-sm/5 font-medium text-muted">Strategy</dt>
            <dd className="mt-1 text-base/6 text-ink">
              {selectedStrategy?.label ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm/5 font-medium text-muted">Scope</dt>
            <dd className="mt-1 text-base/6 text-ink">
              One repetition · idle workload
            </dd>
          </div>
          <div>
            <dt className="text-sm/5 font-medium text-muted">Limits</dt>
            <dd className="mt-1 text-base/6 text-ink">
              {selectedStrategy?.maxActions ?? 3} actions ·{" "}
              {selectedStrategy?.maxTurns ?? 8} turns
            </dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-border pt-5">
          <label
            className="flex min-h-11 cursor-pointer items-start gap-3 text-base/6 text-ink"
            htmlFor="disruption-confirmation"
          >
            <input
              className="mt-1 size-5 shrink-0 accent-primary sm:size-4"
              id="disruption-confirmation"
              name="confirmation"
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              I understand this will disrupt the local managed application.
              Restoration is attempted and verified. A failed restoration
              remains visible.
            </span>
          </label>
          <p className="mt-3 text-sm/5 text-muted">
            Launch checks the lock and all preconditions again. The confirmation
            does not reserve the testbed.
          </p>
        </div>
        {error ? (
          <p className="mt-4 text-base/6 text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="primary-action mt-6 px-4 text-sm/5"
          type="button"
          disabled={
            !acknowledged ||
            (!state.monitor.readiness.canLaunch && !priorRequestId) ||
            pending
          }
          onClick={() => void launch()}
        >
          {pending ? "Starting…" : "Start controlled test"}
        </button>
        {!state.monitor.readiness.canLaunch ? (
          <p className="mt-3 text-sm/5 text-muted">
            {state.monitor.readiness.reasons.join(" ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
