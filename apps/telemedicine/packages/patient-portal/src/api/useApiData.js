import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads async data for a page: { data, error, loading, reload }. Stale responses from an
 * earlier call are ignored, so quick navigation or re-renders can't show the wrong record.
 */
export function useApiData(load, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const call = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(() => {
    const id = ++call.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return run().then(
      (data) => { if (id === call.current) setState({ data, error: null, loading: false }); },
      (error) => { if (id === call.current) setState((s) => ({ ...s, error, loading: false })); },
    );
  }, [run]);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
