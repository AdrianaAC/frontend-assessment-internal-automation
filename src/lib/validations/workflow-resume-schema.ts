import { z } from "zod";
import { aiOutputSchema } from "@/lib/validations/ai-output-schema";
import { dealSchema } from "@/lib/validations/deal-schema";
import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";
import type { WorkflowAIExecutionContext } from "@/types/workflow";

const workflowAIExecutionContextSchema = z.object({
  mode: z.enum(["live", "fallback"]),
  attempts: z.number().int().min(0),
  failureReason: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

const approvalSchema = z.object({
  approvedBy: z.string().trim().min(1, "Approver name is required."),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

const workflowResumeSchema = z.object({
  deal: dealSchema,
  enrichment: aiOutputSchema,
  enrichmentContext: workflowAIExecutionContextSchema,
  approval: approvalSchema,
});

type WorkflowResumeValidationSuccess = {
  success: true;
  data: {
    deal: Deal;
    enrichment: AIOutput;
    enrichmentContext: WorkflowAIExecutionContext;
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
      deal: validation.data.deal,
      enrichment: validation.data.enrichment,
      enrichmentContext: validation.data.enrichmentContext,
      approval: validation.data.approval,
    },
  };
}
