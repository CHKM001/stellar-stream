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

/** Loads the column visibility preferences from localStorage, defaulting all to hidden. */
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

/** Persists the column visibility preferences to localStorage. */
function saveVisibility(visibility: ColumnVisibility): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
}

/**
 * React hook that manages optional stream table column visibility preferences,
 * persisting them to localStorage across sessions.
 * @returns An object with the current visibility state, toggleColumn, and isVisible functions
 */
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
