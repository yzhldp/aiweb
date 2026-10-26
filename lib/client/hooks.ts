"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { LibraryResponse, StatusResponse } from "@/lib/types";

const EMPTY_STATUS: StatusResponse = {
  ok: false,
  docs: 0,
  chunks: 0,
  characters: 0,
  dim: 0,
  embedding: "local",
  llm: "demo",
  storage: "local",
  maxUploadMb: 20,
};

export function useLibraryStatus() {
  const [status, setStatus] = useState<StatusResponse>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<StatusResponse>("/api/status", {
        cache: "no-store",
      });
      setStatus(data);
    } catch {
      setStatus((previous) => ({ ...previous, ok: false }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("learnmate:library-updated", handler);
    return () => window.removeEventListener("learnmate:library-updated", handler);
  }, [refresh]);

  return { status, loading, refresh };
}

export function useLibrary() {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const response = await apiFetch<LibraryResponse>("/api/knowledge", {
        cache: "no-store",
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("learnmate:library-updated", handler);
    return () => window.removeEventListener("learnmate:library-updated", handler);
  }, [refresh]);

  return { data, loading, error, refresh, setData };
}
