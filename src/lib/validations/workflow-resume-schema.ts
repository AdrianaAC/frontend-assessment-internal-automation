import { z } from "zod";

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
});

type WorkflowResumeValidationSuccess = {
  success: true;
  data: {
    workflowRunId: string;
    approval: {
      approvedBy: string;
      notes?: string;
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

  return {
    success: true,
    data: {
      workflowRunId: validation.data.workflowRunId,
      approval: validation.data.approval,
    },
  };
}
