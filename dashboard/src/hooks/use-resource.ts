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
  const [state, setState] = useState<ResourceState<T>>({ data: null, error: null, loading: true });
  const loadRef = useRef(load);
  const requestSequence = useRef(0);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    setState((current) => ({ ...current, error: null, loading: current.data === null }));
    try {
      const data = await loadRef.current(controller.signal);
      if (sequence === requestSequence.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (sequence === requestSequence.current) {
        setState((current) => ({
          data: current.data,
          error: error instanceof ApiError ? error : new ApiError("The read could not be completed.", 0, null),
          loading: false,
        }));
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const fetchCurrent = async () => {
      const sequence = ++requestSequence.current;
      setState((current) => ({ ...current, error: null, loading: current.data === null }));
      try {
        const data = await loadRef.current(controller.signal);
        if (!cancelled && sequence === requestSequence.current) {
          setState({ data, error: null, loading: false });
        }
      } catch (error) {
        if (!cancelled && sequence === requestSequence.current && !(error instanceof DOMException && error.name === "AbortError")) {
          setState((current) => ({
            data: current.data,
            error: error instanceof ApiError ? error : new ApiError("The read could not be completed.", 0, null),
            loading: false,
          }));
        }
      }
    };

    void fetchCurrent();
    const interval = options.pollMs ? window.setInterval(() => void fetchCurrent(), options.pollMs) : undefined;
    return () => {
      cancelled = true;
      controller.abort();
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [options.pollMs, ...dependencies]);

  return { ...state, refresh };
}
