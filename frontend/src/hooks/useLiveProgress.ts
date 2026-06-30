import { useState, useEffect } from "react";
import { Stream, StreamProgress } from "../types/stream";

export interface LiveProgress extends StreamProgress {
  countdownText: string;
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function clean(value: number): number {
  return Number(value.toFixed(6));
}

export function useLiveProgress(stream: Stream): LiveProgress {
  const [now, setNow] = useState(nowInSeconds);

  useEffect(() => {
    const interval = setInterval(() => setNow(nowInSeconds()), 1000);
    return () => clearInterval(interval);
  }, []);

  const progress = stream.progress;

  if (progress.status === "completed" || progress.status === "canceled") {
    return { ...progress, countdownText: "" };
  }

  if (progress.status === "paused") {
    const remainingSeconds = Math.max(0, stream.durationSeconds - progress.elapsedSeconds);
    return {
      ...progress,
      countdownText: formatCountdown(remainingSeconds),
    };
  }

  if (progress.status === "scheduled") {
    const secondsUntilStart = Math.max(0, stream.startAt - now);
    return {
      status: "scheduled",
      ratePerSecond: stream.durationSeconds <= 0 ? Infinity : stream.totalAmount / stream.durationSeconds,
      elapsedSeconds: 0,
      vestedAmount: 0,
      remainingAmount: stream.totalAmount,
      percentComplete: 0,
      countdownText: secondsUntilStart > 0 ? formatCountdown(secondsUntilStart) : "",
    };
  }

  const adjustedStart = stream.startAt + (stream.pausedDuration ?? 0);
  const elapsed = Math.max(0, Math.min(now - adjustedStart, stream.durationSeconds));
  const ratio = stream.durationSeconds <= 0 ? 1 : elapsed / stream.durationSeconds;
  const vestedAmount = clean(stream.totalAmount * ratio);
  const remainingAmount = clean(Math.max(0, stream.totalAmount - vestedAmount));
  const remainingSeconds = Math.max(0, stream.durationSeconds - elapsed);
  const effectiveStatus: StreamProgress["status"] =
    elapsed >= stream.durationSeconds ? "completed" : "active";

  return {
    status: effectiveStatus,
    ratePerSecond:
      stream.durationSeconds <= 0 ? Infinity : stream.totalAmount / stream.durationSeconds,
    elapsedSeconds: elapsed,
    vestedAmount,
    remainingAmount,
    percentComplete: clean(ratio * 100),
    countdownText: formatCountdown(remainingSeconds),
  };
}
