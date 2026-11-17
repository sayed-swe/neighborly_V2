'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, parseError } from './api';

/** Loads a cursor-paginated list (`{ [key]: [...], next }`) and reloads when params change. */
export function usePaged(path, params, key = 'posts') {
  const [items, setItems] = useState(null);
  const [next, setNext] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const req = useRef(0);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const id = ++req.current;
    setItems(null); setError('');
    api.get(path, { params: JSON.parse(paramsKey) })
      .then(({ data }) => { if (id === req.current) { setItems(data[key]); setNext(data.next ?? null); } })
      .catch((e) => { if (id === req.current) { setError(parseError(e).message); setItems([]); } });
  }, [path, paramsKey, key]);

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get(path, { params: { ...JSON.parse(paramsKey), before: next } });
      setItems((cur) => [...cur, ...data[key].filter((x) => !cur.some((c) => c.id === x.id))]);
      setNext(data.next ?? null);
    } catch (e) { setError(parseError(e).message); }
    setLoadingMore(false);
  }, [next, loadingMore, path, paramsKey, key]);

  return { items, setItems, next, loadMore, loadingMore, error };
}
