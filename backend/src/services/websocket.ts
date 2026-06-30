import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import { logger } from "../logger";

interface WebSocketMessage {
  type: string;
  streamId?: string;
  vestedAmount?: number;
  percentComplete?: number;
  timestamp?: number;
}

let wss: WebSocketServer | null = null;

/**
 * Initializes the WebSocket server attached to the HTTP server on the /api/ws path.
 * @param server - The HTTP server to attach the WebSocket server to
 */
export function initWebSocket(server: HttpServer): void {
  wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws: WebSocket) => {
    logger.info("WebSocket client connected");

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (error: Error) => {
      logger.error({ err: error }, "WebSocket error");
    });
  });

  logger.info("WebSocket server initialized on /api/ws");
}

/**
 * Broadcasts real-time stream progress updates to all connected WebSocket clients.
 * @param streamId - The ID of the stream being updated
 * @param vestedAmount - The current vested amount
 * @param percentComplete - The completion percentage (0-1)
 */
export function broadcastStreamProgress(
  streamId: string,
  vestedAmount: number,
  percentComplete: number,
): void {
  if (!wss) {
    return;
  }

  const message: WebSocketMessage = {
    type: "stream_progress",
    streamId,
    vestedAmount,
    percentComplete,
    timestamp: Date.now(),
  };

  const data = JSON.stringify(message);

  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, (error) => {
        if (error) {
          logger.warn({ err: error }, "Failed to send WebSocket message");
        }
      });
    }
  });
}

/**
 * Broadcasts a stream event (e.g. created, claimed, canceled) to all connected WebSocket clients.
 * @param streamId - The ID of the stream the event belongs to
 * @param eventType - The type of event that occurred
 * @param data - Optional additional data for the event
 */
export function broadcastStreamEvent(
  streamId: string,
  eventType: string,
  data?: Record<string, any>,
): void {
  if (!wss) {
    return;
  }

  const message = {
    type: eventType,
    streamId,
    data,
    timestamp: Date.now(),
  };

  const payload = JSON.stringify(message);

  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload, (error) => {
        if (error) {
          logger.warn({ err: error }, "Failed to send WebSocket event");
        }
      });
    }
  });
}
