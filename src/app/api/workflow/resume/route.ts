import {
  buildCorrelationContext,
  createJsonResponse,
  getErrorDetails,
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability/logger";
import { validateWorkflowResumeInput } from "@/lib/validations/workflow-resume-schema";
import { processDeal } from "@/lib/workflow/process-deal";
import {
  getWorkflowRun,
  toWorkflowRunResponse,
  updateWorkflowRun,
} from "@/lib/workflow/workflow-run-store";

// Resumes a paused workflow run using the saved server-side state and a human approval decision.
export async function POST(request: Request) {
  const startedAt = Date.now();
  const correlation = buildCorrelationContext(request, {
    route: "/api/workflow/resume",
  });

  logInfo("api.request.received", correlation);

  try {
    const payload = await request.json();
    const validation = validateWorkflowResumeInput(payload);

    if (!validation.success) {
      logWarn("api.request.validation_failed", {
        ...correlation,
        durationMs: Date.now() - startedAt,
        error: validation.error,
        details: validation.details,
      });

      return createJsonResponse(
        {
          error: validation.error,
          details: validation.details,
        },
        { status: 400 },
        correlation.correlationId
      );
    }

    const workflowRun = await getWorkflowRun(validation.data.workflowRunId);
    const workflowState = workflowRun?.response ?? validation.data.workflow;
    const requestContext = {
      ...correlation,
      workflowRunId: validation.data.workflowRunId,
      sourceEventId: workflowRun?.sourceEventId,
    };

    if (!workflowState) {
      logWarn("api.request.not_found", {
        ...requestContext,
        durationMs: Date.now() - startedAt,
      });

      return createJsonResponse(
        { error: "Workflow run was not found." },
        { status: 404 },
        correlation.correlationId
      );
    }

    if (workflowState.approval.status !== "pending") {
      logWarn("api.request.conflict", {
        ...requestContext,
        durationMs: Date.now() - startedAt,
        approvalStatus: workflowState.approval.status,
      });

      return createJsonResponse(
        { error: "Workflow run is not awaiting approval." },
        { status: 409 },
        correlation.correlationId
      );
    }

    const result = await processDeal(workflowState.deal, {
      enrichmentContext: workflowState.enrichmentContext,
      enrichmentOverride: workflowState.enrichment,
      approvalDecision: validation.data.approval,
      observability: requestContext,
    });
    const updatedWorkflowRun = workflowRun
      ? await updateWorkflowRun(validation.data.workflowRunId, result)
      : null;

    if (workflowRun && !updatedWorkflowRun) {
      logWarn("api.request.not_found", {
        ...requestContext,
        durationMs: Date.now() - startedAt,
        when: "update",
      });

      return createJsonResponse(
        { error: "Workflow run was not found." },
        { status: 404 },
        correlation.correlationId
      );
    }

    logInfo("api.request.completed", {
      ...requestContext,
      durationMs: Date.now() - startedAt,
      statusCode: 200,
    });

    return createJsonResponse(
      updatedWorkflowRun
        ? toWorkflowRunResponse(updatedWorkflowRun)
        : {
            workflowRunId: validation.data.workflowRunId,
            ...result,
          },
      { status: 200 },
      correlation.correlationId
    );
  } catch (error) {
    logError("api.request.failed", {
      ...correlation,
      durationMs: Date.now() - startedAt,
      error: getErrorDetails(error),
    });

    return createJsonResponse(
      { error: "Failed to resume workflow." },
      { status: 500 },
      correlation.correlationId
    );
  }
}
