import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

export interface TimeseriesParams {
  start?: string | null;
  end?: string | null;
  granularity: string;
  range: string;
  mode: "live" | "historical";
  url: string;
  token: string;
  metrics: string[];
  hosts: string[];
  isDemoRequest?: boolean;
}

export function useTimeseries(
  params: TimeseriesParams,
  metricDict: Record<string, { itemid: string; value_type: string; lastvalue: string }>,
  skip = false,
  pollingInterval = 30000
) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedParamsHash, setFetchedParamsHash] = useState<string | null>(null);
  
  const currentParamsHash = JSON.stringify(params);
  
  // Track continuous polling via ref to avoid React state re-eval sync issues
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTimeseries = useCallback(async (isSilent = false) => {
    if (skip) return;
    if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const hashForThisFetch = JSON.stringify(params);

    try {
      const response = await axios.post("/api/timeseries", {
        start: params.start,
        end: params.end,
        granularity: params.granularity,
        range: params.range,
        mode: params.mode,
        url: params.url,
        token: params.token,
        metrics: params.metrics,
        hosts: params.hosts,
        itemDict: metricDict,
        isDemoRequest: params.isDemoRequest
      }, {
        signal: abortController.signal
      });

      if (response.data && Array.isArray(response.data)) {
        setData(response.data);
      } else {
        setData([]);
      }
      setFetchedParamsHash(hashForThisFetch);
    } catch (err: any) {
      if (axios.isCancel(err)) {
        return; // Request was aborted, do nothing
      }
      console.error("Timeseries Fetch Error:", err);
      // Only set error if not silent
      if (!isSilent) {
        setError(err.response?.data?.error || err.message || "Failed to load timeseries statistics.");
        setFetchedParamsHash(hashForThisFetch);
      }
    } finally {
      if (!isSilent && abortControllerRef.current === abortController) {
        setIsLoading(false);
      }
    }
  }, [
    params.start,
    params.end,
    params.granularity,
    params.range,
    params.mode,
    params.url,
    params.token,
    params.metrics,
    params.hosts,
    params.isDemoRequest,
    metricDict,
    skip
  ]);

  // Handle active or background polling
  useEffect(() => {
    if (skip) return;
    fetchTimeseries();

    if (params.mode === "live") {
      timerRef.current = setInterval(() => {
        fetchTimeseries(true);
      }, pollingInterval);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchTimeseries, params.mode, pollingInterval, skip]);

  const isSyncing = isLoading || (fetchedParamsHash !== currentParamsHash);

  return {
    data,
    isLoading: isSyncing,
    error,
    refetch: fetchTimeseries
  };
}
