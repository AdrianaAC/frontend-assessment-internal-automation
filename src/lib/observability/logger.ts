import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogValue[]
  | { [key: string]: LogValue };

export type LogContext = Record<string, LogValue>;

export type CorrelationContext = {
  correlationId: string;
  route?: string;
  workflowRunId?: string;
  sourceEventId?: string;
};

// Converts any value into a JSON-safe shape before it is written to logs.
function sanitizeLogValue(value: unknown): LogValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeLogValue(nestedValue),
      ])
    );
  }

  return String(value);
}

// Cleans every field in a log context so structured logging stays safe and readable.
function sanitizeLogContext(context: LogContext) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeLogValue(value)])
  );
}

// Generates a new trace id that can follow one request across the system.
export function createCorrelationId() {
  return randomUUID();
}

// Reuses an incoming trace id when possible, or creates one if none was provided.
export function getRequestCorrelationId(request: Request) {
  return (
    request.headers.get("x-correlation-id") ??
    request.headers.get("x-request-id") ??
    createCorrelationId()
  );
}

// Builds the shared tracing context attached to logs and API responses.
export function buildCorrelationContext(
  request: Request,
  overrides: Omit<CorrelationContext, "correlationId"> & {
    correlationId?: string;
  } = {}
): CorrelationContext {
  return {
    correlationId: overrides.correlationId ?? getRequestCorrelationId(request),
    route: overrides.route,
    workflowRunId: overrides.workflowRunId,
    sourceEventId: overrides.sourceEventId,
  };
}

// Returns JSON responses with the correlation id attached as a response header.
export function createJsonResponse<T>(
  body: T,
  init: ResponseInit | undefined,
  correlationId: string
) {
  const response = Response.json(body, init);
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

// Normalizes thrown errors into a predictable shape for logs.
export function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  };
}

// Writes one structured log event to the console.
export function logEvent(
  level: LogLevel,
  event: string,
  context: LogContext = {}
) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeLogContext(context),
  };

  console[level](JSON.stringify(payload));
}

// Writes an informational log entry.
export function logInfo(event: string, context: LogContext = {}) {
  logEvent("info", event, context);
}

// Writes a warning log entry.
export function logWarn(event: string, context: LogContext = {}) {
  logEvent("warn", event, context);
}

// Writes an error log entry.
export function logError(event: string, context: LogContext = {}) {
  logEvent("error", event, context);
}
