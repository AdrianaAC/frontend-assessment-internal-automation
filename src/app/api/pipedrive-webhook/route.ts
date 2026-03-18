import {
  buildCorrelationContext,
  createJsonResponse,
  getErrorDetails,
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability/logger";
import { validateAndMapPipedriveWebhook } from "@/lib/validations/pipedrive-webhook-schema";
import {
  markWebhookEventProcessed,
  releaseWebhookEventProcessing,
  startWebhookEventProcessing,
} from "@/lib/workflow/webhook-event-store";
import {
  createWorkflowRun,
  toWorkflowRunResponse,
} from "@/lib/workflow/workflow-run-store";
import { processDeal } from "@/lib/workflow/process-deal";

// Accepts a Pipedrive webhook, runs the workflow, and persists the resulting workflow run.
export async function POST(request: Request) {
  const startedAt = Date.now();
  const correlation = buildCorrelationContext(request, {
    route: "/api/pipedrive-webhook",
  });

  logInfo("api.request.received", correlation);

  try {
    const payload = await request.json();
    const validation = validateAndMapPipedriveWebhook(payload);

    if (!validation.success) {
      logWarn("api.request.validation_failed", {
        ...correlation,
        durationMs: Date.now() - startedAt,
        error: validation.error,
        fieldErrors: validation.fieldErrors,
      });

      return createJsonResponse(
        {
          error: validation.error,
          fieldErrors: validation.fieldErrors,
        },
        { status: 400 },
        correlation.correlationId
      );
    }

    const requestContext = {
      ...correlation,
      sourceEventId: validation.data.eventId,
    };

    const claim = await startWebhookEventProcessing({
      eventId: validation.data.eventId,
      occurredAt: validation.data.occurredAt,
      source: "pipedrive-webhook",
    });

    if (!claim.ok) {
      const duplicateReason =
        claim.reason === "processing" ? "is already being processed" : "was already processed";

      logWarn("api.webhook.duplicate_event", {
        ...requestContext,
        durationMs: Date.now() - startedAt,
        reason: claim.reason,
      });

      return createJsonResponse(
        {
          error: `Webhook event ${validation.data.eventId} ${duplicateReason}.`,
        },
        { status: 409 },
        correlation.correlationId
      );
    }

    try {
      const result = await processDeal(validation.data.deal, {
        observability: requestContext,
      });
      const workflowRun = await createWorkflowRun({
        response: result,
        sourceEventId: validation.data.eventId,
      });
      await markWebhookEventProcessed({
        eventId: validation.data.eventId,
        workflowRunId: workflowRun.workflowRunId,
      });

      logInfo("api.request.completed", {
        ...requestContext,
        workflowRunId: workflowRun.workflowRunId,
        durationMs: Date.now() - startedAt,
        statusCode: 200,
      });

      return createJsonResponse(
        toWorkflowRunResponse(workflowRun),
        { status: 200 },
        correlation.correlationId
      );
    } catch (error) {
      await releaseWebhookEventProcessing(validation.data.eventId);

      logError("api.request.failed", {
        ...requestContext,
        durationMs: Date.now() - startedAt,
        error: getErrorDetails(error),
      });

      return createJsonResponse(
        { error: "Failed to process deal." },
        { status: 500 },
        correlation.correlationId
      );
    }
  } catch (error) {
    logError("api.request.failed", {
      ...correlation,
      durationMs: Date.now() - startedAt,
      error: getErrorDetails(error),
    });

    return createJsonResponse(
      { error: "Failed to process deal." },
      { status: 500 },
      correlation.correlationId
    );
  }
}
