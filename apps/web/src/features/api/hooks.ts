import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicMeta } from '@soclear/contracts';
import { apiGet, errorMessage, withQuery } from './client';

export type QueryParams = Record<string, string | number | undefined | null>;

interface PageMeta extends PublicMeta {
  page?: { total: number; hasMore: boolean; nextCursor: string | null };
}

interface PaginatedState<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const emptyState = <T,>(): PaginatedState<T> => ({
  items: [],
  total: 0,
  nextCursor: null,
  hasMore: false,
  loading: true,
  loadingMore: false,
  error: null,
});

export interface PaginatedResult<T> extends PaginatedState<T> {
  reload: () => void;
  loadMore: () => void;
}

export function usePaginatedApi<T>(
  path: string,
  params: QueryParams,
  enabled = true,
  pageSize = 20,
): PaginatedResult<T> {
  const paramsKey = JSON.stringify(params);
  const [state, setState] = useState<PaginatedState<T>>(emptyState);
  const [version, setVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const buildUrl = useCallback(
    (cursor: string | null) => {
      const parsed = JSON.parse(paramsKey) as QueryParams;
      return withQuery(path, { ...parsed, limit: pageSize, cursor });
    },
    [pageSize, paramsKey, path],
  );

  useEffect(() => {
    if (!enabled) {
      setState({ ...emptyState(), loading: false });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const currentRequest = ++requestRef.current;
    setState({ ...emptyState(), loading: true });

    apiGet<T[]>(buildUrl(null), controller.signal)
      .then((result) => {
        if (requestRef.current !== currentRequest) return;
        const page = (result.meta as PageMeta).page;
        setState({
          items: result.data,
          total: page?.total ?? result.data.length,
          nextCursor: page?.nextCursor ?? null,
          hasMore: page?.hasMore ?? false,
          loading: false,
          loadingMore: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestRef.current !== currentRequest) return;
        setState({ ...emptyState(), loading: false, error: errorMessage(error) });
      });

    return () => controller.abort();
  }, [buildUrl, enabled, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (!current.nextCursor || current.loadingMore || current.loading) return;
    const controller = abortRef.current;
    if (!controller || controller.signal.aborted) return;

    const currentRequest = requestRef.current;
    setState((previous) => ({ ...previous, loadingMore: true, error: null }));

    apiGet<T[]>(buildUrl(current.nextCursor), controller.signal)
      .then((result) => {
        if (requestRef.current !== currentRequest) return;
        const page = (result.meta as PageMeta).page;
        setState((previous) => ({
          ...previous,
          items: [...previous.items, ...result.data],
          total: page?.total ?? previous.total,
          nextCursor: page?.nextCursor ?? null,
          hasMore: page?.hasMore ?? false,
          loadingMore: false,
          error: null,
        }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestRef.current !== currentRequest) return;
        setState((previous) => ({
          ...previous,
          loadingMore: false,
          error: errorMessage(error),
        }));
      });
  }, [buildUrl]);

  return { ...state, reload, loadMore };
}

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface ResourceResult<T> extends ResourceState<T> {
  reload: () => void;
}

export function useApiResource<T>(path: string | null, enabled = true): ResourceResult<T> {
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    loading: Boolean(path) && enabled,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path || !enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ data: previous.data, loading: true, error: null }));

    apiGet<T>(path, controller.signal)
      .then((result) => setState({ data: result.data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ data: null, loading: false, error: errorMessage(error) });
      });

    return () => controller.abort();
  }, [enabled, path, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
