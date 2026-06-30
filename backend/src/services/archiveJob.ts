import { archiveOldStreams } from "./streamStore";
import { logger } from "../logger";

let archiveInterval: NodeJS.Timeout | null = null;
let archiveInFlight = false;

/**
 * Runs a single archive cycle, moving old completed/canceled streams to the archive table.
 * Skips execution if a previous cycle is still in progress.
 */
async function runArchiveCycle(): Promise<void> {
  if (archiveInFlight) {
    logger.warn("skipping archive cycle because a previous run is still in progress");
    return;
  }

  archiveInFlight = true;
  try {
    const archived = await archiveOldStreams();
    if (archived > 0) {
      logger.info({ archived }, "archived old streams");
    }
  } finally {
    archiveInFlight = false;
  }
}

/**
 * Starts the background archive job that periodically moves old streams to the archive table.
 * @param intervalMs - Archive interval in milliseconds (default 86400000 = daily)
 */
export function startArchiveJob(intervalMs = 86400000): void {
  if (archiveInterval) {
    return;
  }

  logger.info({ intervalMs }, "archive job started");

  archiveInterval = setInterval(() => {
    runArchiveCycle().catch((err) => {
      logger.error({ err }, "archive job cycle failed");
    });
  }, intervalMs);

  runArchiveCycle().catch((err) => {
    logger.error({ err }, "initial archive cycle failed");
  });
}

/** Stops the background archive job. */
export function stopArchiveJob(): void {
  if (!archiveInterval) {
    return;
  }

  clearInterval(archiveInterval);
  archiveInterval = null;
  logger.info("archive job stopped");
}
