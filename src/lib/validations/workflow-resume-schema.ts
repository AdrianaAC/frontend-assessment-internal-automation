import { z } from "zod";
import { validateAIOutput } from "@/lib/validations/ai-output-schema";
import { validateDealInput } from "@/lib/validations/deal-schema";
import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";
import type {
  WorkflowAIExecutionContext,
  WorkflowApprovalState,
} from "@/types/workflow";

const approvalSchema = z.object({
  approvedBy: z.string().trim().min(1, "Approver name is required."),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

const workflowResumeSchema = z.object({
  workflowRunId: z.string().trim().min(1, "Workflow run ID is required."),
  approval: approvalSchema,
  workflow: z
    .object({
      deal: z.unknown(),
      enrichment: z.unknown(),
      enrichmentContext: z.object({
        mode: z.enum(["live", "fallback"]),
        attempts: z.number().int().min(0),
        failureReason: z.string().trim().optional(),
      }),
      approval: z.object({
        status: z.enum(["not_required", "pending", "approved"]),
      }),
    })
    .optional(),
});

type WorkflowResumeValidationSuccess = {
  success: true;
  data: {
    workflowRunId: string;
    approval: {
      approvedBy: string;
      notes?: string;
    };
    workflow?: {
      deal: Deal;
      enrichment: AIOutput;
      enrichmentContext: WorkflowAIExecutionContext;
      approval: Pick<WorkflowApprovalState, "status">;
    };
  };
};

type WorkflowResumeValidationFailure = {
  success: false;
  error: string;
  details?: string[];
};

export type WorkflowResumeValidationResult =
  | WorkflowResumeValidationSuccess
  | WorkflowResumeValidationFailure;

// Validates the approval payload used to resume a paused workflow run.
export function validateWorkflowResumeInput(
  input: unknown
): WorkflowResumeValidationResult {
  const validation = workflowResumeSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      error: "Invalid workflow resume payload.",
      details: validation.error.issues.map((issue) => issue.message),
    };
  }

  let workflowState: WorkflowResumeValidationSuccess["data"]["workflow"];

  if (validation.data.workflow) {
    const dealValidation = validateDealInput(validation.data.workflow.deal);

    if (!dealValidation.success) {
      return {
        success: false,
        error: "Invalid workflow resume payload.",
        details: ["Workflow snapshot contains an invalid deal payload."],
      };
    }

    const enrichmentValidation = validateAIOutput(
      validation.data.workflow.enrichment
    );

    if (!enrichmentValidation.success) {
      return {
        success: false,
        error: "Invalid workflow resume payload.",
        details: ["Workflow snapshot contains an invalid enrichment payload."],
      };
    }

    workflowState = {
      deal: dealValidation.data,
      enrichment: enrichmentValidation.data,
      enrichmentContext: validation.data.workflow.enrichmentContext,
      approval: validation.data.workflow.approval,
    };
  }

  return {
    success: true,
    data: {
      workflowRunId: validation.data.workflowRunId,
      approval: validation.data.approval,
      workflow: workflowState,
    },
  };
}
