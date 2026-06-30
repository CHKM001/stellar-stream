import { useEffect, useState } from "react";
import { fetchMetricsHistory } from "../services/api";

export interface MetricsSnapshot {
  timestamp: number;
  active: number;
  completed: number;
  vested: number;
}

export type TimeRange = "7d" | "30d" | "all";

interface MetricsHistoryState {
  data: MetricsSnapshot[];
  loading: boolean;
  error: Error | null;
}

export function useMetricsHistory(timeRange: TimeRange): MetricsHistoryState {
  const [state, setState] = useState<MetricsHistoryState>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchHistory() {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const now = Date.now();
        let startTimestamp: number;

        switch (timeRange) {
          case "7d":
            startTimestamp = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case "30d":
            startTimestamp = now - 30 * 24 * 60 * 60 * 1000;
            break;
          case "all":
            startTimestamp = 0;
            break;
          default:
            startTimestamp = now - 7 * 24 * 60 * 60 * 1000;
        }

        const data = await fetchMetricsHistory({
          startTimestamp,
          endTimestamp: now,
        });

        setState({
          data,
          loading: false,
          error: null,
        });
      } catch (error) {
        setState({
          data: [],
          loading: false,
          error: error as Error,
        });
      }
    }

    fetchHistory();
  }, [timeRange]);

  return state;
}
