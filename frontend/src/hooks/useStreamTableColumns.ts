import { useCallback, useEffect, useState } from "react";

export type OptionalStreamColumn =
  | "assetCode"
  | "duration"
  | "ratePerSecond"
  | "pausedDuration";

export const OPTIONAL_STREAM_COLUMNS: OptionalStreamColumn[] = [
  "assetCode",
  "duration",
  "ratePerSecond",
  "pausedDuration",
];

export const OPTIONAL_COLUMN_LABELS: Record<OptionalStreamColumn, string> = {
  assetCode: "Asset",
  duration: "Duration",
  ratePerSecond: "Rate / sec",
  pausedDuration: "Paused duration",
};

const STORAGE_KEY = "stream-table-columns";

export type ColumnVisibility = Record<OptionalStreamColumn, boolean>;

const DEFAULT_VISIBILITY: ColumnVisibility = {
  assetCode: false,
  duration: false,
  ratePerSecond: false,
  pausedDuration: false,
};

function loadVisibility(): ColumnVisibility {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    const parsed = JSON.parse(raw) as Partial<ColumnVisibility>;
    return { ...DEFAULT_VISIBILITY, ...parsed };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

function saveVisibility(visibility: ColumnVisibility): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
}

export function useStreamTableColumns() {
  const [visibility, setVisibility] = useState<ColumnVisibility>(loadVisibility);

  useEffect(() => {
    saveVisibility(visibility);
  }, [visibility]);

  const toggleColumn = useCallback((column: OptionalStreamColumn) => {
    setVisibility((prev) => {
      const next = { ...prev, [column]: !prev[column] };
      saveVisibility(next);
      return next;
    });
  }, []);

  const isVisible = useCallback(
    (column: OptionalStreamColumn) => visibility[column],
    [visibility],
  );

  return { visibility, toggleColumn, isVisible };
}
