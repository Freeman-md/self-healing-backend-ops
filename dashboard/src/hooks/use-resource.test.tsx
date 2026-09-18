// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ApiError } from "../api";
import { useResource } from "./use-resource";

test("refresh cancels superseded reads, preserves errors until success, and ignores unmounted results", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const requests: {
    signal: AbortSignal;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  }[] = [];
  let current: ReturnType<typeof useResource<string>> | undefined;
  function Probe() {
    current = useResource(
      (signal) =>
        new Promise<string>((resolve, reject) =>
          requests.push({ signal, resolve, reject }),
        ),
      [],
    );
    return (
      <span>
        {current.data}:{current.error?.message}
      </span>
    );
  }
  const element = document.createElement("div");
  const root = createRoot(element);
  await act(async () => root.render(<Probe />));
  await act(async () => requests[0].resolve("historical"));
  await act(async () => {
    void current!.refresh();
  });
  await act(async () => requests[1].reject(new ApiError("offline", 0, null)));
  await act(async () => {
    void current!.refresh();
  });
  expect(element.textContent).toBe("historical:offline");
  await act(async () => {
    void current!.refresh();
  });
  expect(requests[2].signal.aborted).toBe(true);
  await act(async () => requests[3].resolve("latest"));
  await act(async () => requests[2].resolve("stale"));
  expect(element.textContent).toBe("latest:");
  await act(async () => {
    void current!.refresh();
  });
  await act(async () => root.unmount());
  expect(requests[4].signal.aborted).toBe(true);
  await act(async () => requests[4].resolve("late"));
  expect(element.textContent).toBe("");
  vi.unstubAllGlobals();
});
