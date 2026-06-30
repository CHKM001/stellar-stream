import { reconcileMissingStreams, getOnChainStreamCount } from "./streamStore";
import { getDb } from "./db";
import { logger } from "../logger";

let reconciliationInterval: NodeJS.Timeout | null = null;
let reconciliationInFlight = false;

/**
 * Runs a single reconciliation cycle: reconciles missing streams and checks for count discrepancies.
 * Skips execution if a previous cycle is still in progress.
 */
async function runReconciliationCycle(): Promise<void> {
  if (reconciliationInFlight) {
    logger.warn("skipping reconciliation cycle because a previous run is still in progress");
    return;
  }

  reconciliationInFlight = true;
  try {
    await reconcileMissingStreams();
    await checkStreamCountDiscrepancy();
  } finally {
    reconciliationInFlight = false;
  }
}

/**
 * Compares the on-chain stream count with the local database count and logs a warning if they differ.
 */
async function checkStreamCountDiscrepancy(): Promise<void> {
  const onChainCount = await getOnChainStreamCount();
  if (onChainCount === null) return;

  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS total FROM streams").get() as { total: number };
  const localCount = row.total;

  if (onChainCount !== localCount) {
    logger.warn(
      { onChainStreamCount: onChainCount, localStreamCount: localCount },
      "stream count discrepancy detected between on-chain and local database",
    );
  }
}

/**
 * Starts the background reconciliation job that periodically syncs local state with the Stellar chain.
 * @param intervalMs - Reconciliation interval in milliseconds (default 60000)
 */
export function startReconciliationJob(intervalMs = 60000): void {
  if (reconciliationInterval) {
    return;
  }

  logger.info({ intervalMs }, "reconciliation job started");

  reconciliationInterval = setInterval(() => {
    runReconciliationCycle().catch((err) => {
      logger.error({ err }, "reconciliation job cycle failed");
    });
  }, intervalMs);

  runReconciliationCycle().catch((err) => {
    logger.error({ err }, "initial reconciliation failed");
  });
}

/** Stops the background reconciliation job. */
export function stopReconciliationJob(): void {
  if (!reconciliationInterval) {
    return;
  }

  clearInterval(reconciliationInterval);
  reconciliationInterval = null;
  logger.info("reconciliation job stopped");
}
