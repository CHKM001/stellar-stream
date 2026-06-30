import { AsyncLocalStorage } from "async_hooks";

interface CorrelationContext {
  correlationId: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Retrieves the correlation ID for the current async context.
 * @returns The current correlation ID, or undefined if not within a correlation context
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

/**
 * Executes a function within a correlation context, making the correlation ID
 * available via getCorrelationId() throughout the execution.
 * @param correlationId - The correlation ID to associate with this context
 * @param fn - The function to execute within the correlation context
 * @returns The return value of the executed function
 */
export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run({ correlationId }, fn);
}
