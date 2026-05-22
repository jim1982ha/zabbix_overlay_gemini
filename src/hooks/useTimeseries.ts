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
}

export function useTimeseries(
  params: TimeseriesParams,
  metricDict: Record<string, { itemid: string; value_type: string; lastvalue: string }>,
  pollingInterval = 30000
) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track continuous polling via ref to avoid React state re-eval sync issues
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTimeseries = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

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
        itemDict: metricDict
      });

      if (response.data) {
        setData(response.data);
      }
    } catch (err: any) {
      console.error("Timeseries Fetch Error:", err);
      // Only set error if not silent (background polling errors shouldn't disrupt active viewing if they are transient)
      if (!isSilent) {
        setError(err.response?.data?.error || err.message || "Failed to load timeseries statistics.");
      }
    } finally {
      if (!isSilent) {
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
    metricDict
  ]);

  // Handle active or background polling
  useEffect(() => {
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
  }, [fetchTimeseries, params.mode, pollingInterval]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchTimeseries
  };
}
