import { api, type OperatorState } from "./api";
import { ReadFailure, Shell, ViewBoundary } from "./components";
import {
  AttentionPage,
  ControlledTestPage,
  ExperimentsPage,
  RecoveryCasesPage,
  SystemPage,
  TrialsPage,
} from "./pages";
import { useResource } from "./hooks/use-resource";

function destination(pathname: string, state: OperatorState | null) {
  if (pathname === "/trials") return <TrialsPage />;
  if (pathname === "/attention") return <AttentionPage />;
  if (pathname === "/experiments") return <ExperimentsPage />;
  if (pathname === "/recovery-cases") return <RecoveryCasesPage />;
  if (pathname === "/controlled-test")
    return <ControlledTestPage state={state} />;
  return <SystemPage state={state} />;
}

export function App() {
  const pathname = window.location.pathname;
  const state = useResource((signal) => api.getState(signal), [], {
    pollMs: 10_000,
  });
  const attention = useResource((signal) => api.listAttention(signal), [], {
    pollMs: 10_000,
  });
  const attentionCount =
    attention.data?.filter((record) => record.state !== "reviewed").length ??
    null;
  const visibleState: OperatorState | null =
    state.data && state.error
      ? {
          ...state.data,
          controlPlane: {
            status: "unavailable",
            message:
              "The latest refresh failed. Displayed observations are historical; current health is unknown.",
          },
          evidence: state.data.evidence
            ? { ...state.data.evidence, freshness: "stale" }
            : null,
          monitor: {
            ...state.data.monitor,
            state: "unavailable",
            readiness: {
              canLaunch: false,
              reasons: ["Refresh the control plane before launching new work."],
            },
          },
        }
      : state.data;

  return (
    <Shell pathname={pathname} attentionCount={attentionCount}>
      {state.error &&
      !state.data &&
      pathname !== "/trials" &&
      pathname !== "/attention" &&
      pathname !== "/experiments" &&
      pathname !== "/recovery-cases" ? (
        <ReadFailure
          message={state.error.message}
          correlationId={state.error.correlationId}
          onRetry={state.refresh}
        />
      ) : (
        <ViewBoundary>
          {state.error ? (
            <ReadFailure
              message={state.error.message}
              correlationId={state.error.correlationId}
              onRetry={state.refresh}
            />
          ) : null}
          {destination(pathname, visibleState)}
        </ViewBoundary>
      )}
    </Shell>
  );
}
