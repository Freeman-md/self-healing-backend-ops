import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../api";

type ResourceState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
};

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
  options: { pollMs?: number } = {},
) {
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const loadRef = useRef(load);
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState((current) => ({ ...current, loading: current.data === null }));
    try {
      const data = await loadRef.current(controller.signal);
      if (mounted.current && sequence === requestSequence.current)
        setState({ data, error: null, loading: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (mounted.current && sequence === requestSequence.current) {
        setState((current) => ({
          data: current.data,
          error:
            error instanceof ApiError
              ? error
              : new ApiError("The read could not be completed.", 0, null),
          loading: false,
        }));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = options.pollMs
      ? window.setInterval(() => void refresh(), options.pollMs)
      : undefined;
    return () => {
      mounted.current = false;
      ++requestSequence.current;
      activeRequest.current?.abort();
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [refresh, options.pollMs, ...dependencies]);

  return { ...state, refresh };
}
