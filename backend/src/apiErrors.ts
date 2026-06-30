import { Request, Response } from "express";
import { z } from "zod";
import {
  ValidationIssue,
  zodIssuesToErrorMessage,
  zodIssuesToValidationIssues,
} from "./validation/schemas";

export type ApiErrorResponse = {
  error: string;
  statusCode: number;
  requestId?: string;
  correlationId?: string;
  code?: string;
  details?: ValidationIssue[];
};

type ApiErrorOptions = {
  code?: string;
  details?: ValidationIssue[];
};

/**
 * Builds a standardized API error response object with request metadata.
 * @param req - The incoming Express request
 * @param statusCode - The HTTP status code for the error
 * @param error - A human-readable error message
 * @param options - Optional error code and validation details
 * @returns A structured API error response object
 */
export function buildApiErrorResponse(
  req: Request,
  statusCode: number,
  error: string,
  options: ApiErrorOptions = {},
): ApiErrorResponse {
  return {
    error,
    statusCode,
    requestId: req.requestId,
    correlationId: req.correlationId,
    code: options.code,
    details: options.details,
  };
}

/**
 * Sends a standardized JSON error response to the client.
 * @param req - The incoming Express request
 * @param res - The Express response object
 * @param statusCode - The HTTP status code for the error
 * @param error - A human-readable error message
 * @param options - Optional error code and validation details
 */
export function sendApiError(
  req: Request,
  res: Response,
  statusCode: number,
  error: string,
  options: ApiErrorOptions = {},
) {
  return res.status(statusCode).json(buildApiErrorResponse(req, statusCode, error, options));
}

/**
 * Sends a 400 validation error response derived from Zod schema issues.
 * @param req - The incoming Express request
 * @param res - The Express response object
 * @param issues - Array of Zod validation issues to report
 */
export function sendValidationError(
  req: Request,
  res: Response,
  issues: z.ZodIssue[],
) {
  return sendApiError(req, res, 400, zodIssuesToErrorMessage(issues), {
    code: "VALIDATION_ERROR",
    details: zodIssuesToValidationIssues(issues),
  });
}

/**
 * Sends a consistent JSON error response with request ID tracking.
 * @param res - The Express response object
 * @param status - The HTTP status code for the error
 * @param message - A human-readable error message
 * @param req - The incoming Express request
 * @param options - Optional error code and validation details
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  req: Request,
  options: ApiErrorOptions = {}
) {
  return res.status(status).json(buildApiErrorResponse(req, status, message, options));
}

/**
 * Normalizes an unknown error value into a structured error object with status, message, and code.
 * Extracts statusCode, message, and code from the error if it has those properties,
 * otherwise returns the fallback message with a 500 status.
 * @param error - The unknown error value to normalize
 * @param fallbackMessage - Default message to use when the error lacks a readable message
 * @returns A normalized error object with statusCode, message, and optional code
 */
export function normalizeUnknownApiError(
  error: unknown,
  fallbackMessage: string,
): {
  statusCode: number;
  message: string;
  code?: string;
} {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      statusCode?: unknown;
      code?: unknown;
    };

    return {
      statusCode:
        typeof candidate.statusCode === "number" ? candidate.statusCode : 500,
      message:
        typeof candidate.message === "string" && candidate.message.trim().length > 0
          ? candidate.message
          : fallbackMessage,
      code: typeof candidate.code === "string" ? candidate.code : undefined,
    };
  }

  return {
    statusCode: 500,
    message: fallbackMessage,
  };
}
