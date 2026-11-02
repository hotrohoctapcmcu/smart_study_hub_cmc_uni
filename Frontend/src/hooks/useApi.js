import { useState, useEffect, useCallback, useRef } from "react";
import { unwrapResponse } from "../api/apiClient";

export function useApi(apiFn, { immediate = true } = {}) {
  const fn = useRef(apiFn);
  fn.current = apiFn;
  const version = useRef(0);
  const [state, setState] = useState({
    data: null,
    response: null,
    loading: immediate,
    error: null,
  });
  const execute = useCallback(async (...args) => {
    const request = ++version.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await fn.current(...args);
      const data = unwrapResponse(response);
      if (request === version.current)
        setState({ data, response, loading: false, error: null });
      return data;
    } catch (error) {
      if (request === version.current)
        setState((s) => ({ ...s, error, loading: false }));
      return undefined;
    }
  }, []);
  useEffect(() => {
    if (immediate) execute();
    return () => {
      version.current++;
    };
  }, [execute, immediate]);
  return { ...state, execute, refetch: () => execute() };
}
export function useApiMutation(apiFn) {
  return useApi(apiFn, { immediate: false });
}
