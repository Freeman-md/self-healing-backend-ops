import { api, type OperatorState } from "./api";
import { ReadFailure, Shell } from "./components";
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
  if (pathname === "/controlled-test") return <ControlledTestPage state={state} />;
  return <SystemPage state={state} />;
}

export function App() {
  const pathname = window.location.pathname;
  const state = useResource((signal) => api.getState(signal), [], { pollMs: 10_000 });
  const attention = useResource((signal) => api.listAttention(signal), [], { pollMs: 10_000 });
  const attentionCount = attention.data?.filter((record) => record.state !== "reviewed").length ?? null;

  return (
    <Shell pathname={pathname} attentionCount={attentionCount}>
      {state.error && !state.data && pathname !== "/trials" && pathname !== "/attention" && pathname !== "/experiments" && pathname !== "/recovery-cases" ? (
        <ReadFailure message={state.error.message} correlationId={state.error.correlationId} onRetry={state.refresh} />
      ) : (
        destination(pathname, state.data)
      )}
    </Shell>
  );
}
