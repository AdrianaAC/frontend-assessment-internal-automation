import { z } from "zod";
import type { AIOutput } from "@/types/ai-output";

export const suggestedTaskSchema = z.object({
  title: z.string().trim().min(1, "clickupTasks[].title is required."),
  description: z
    .string()
    .trim()
    .min(1, "clickupTasks[].description is required."),
  owner: z.string().trim().min(1, "clickupTasks[].owner is required."),
  priority: z.enum(["low", "medium", "high"]),
});

export const aiOutputSchema = z.object({
  projectClassification: z.object({
    projectType: z
      .string()
      .trim()
      .min(1, "projectClassification.projectType is required."),
    complexity: z.enum(["low", "medium", "high"]),
    riskLevel: z.enum(["low", "medium", "high"]),
    recommendedTemplate: z
      .string()
      .trim()
      .min(1, "projectClassification.recommendedTemplate is required."),
  }),
  kickoffEmail: z.object({
    subject: z.string().trim().min(1, "kickoffEmail.subject is required."),
    body: z.string().trim().min(1, "kickoffEmail.body is required."),
  }),
  teamsIntroMessage: z
    .string()
    .trim()
    .min(1, "teamsIntroMessage is required."),
  clickupTasks: z
    .array(suggestedTaskSchema)
    .min(1, "clickupTasks must contain at least one task."),
});

export const aiOutputJsonSchema = {
  name: "workflow_ai_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "projectClassification",
      "kickoffEmail",
      "teamsIntroMessage",
      "clickupTasks",
    ],
    properties: {
      projectClassification: {
        type: "object",
        additionalProperties: false,
        required: [
          "projectType",
          "complexity",
          "riskLevel",
          "recommendedTemplate",
        ],
        properties: {
          projectType: {
            type: "string",
          },
          complexity: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          riskLevel: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          recommendedTemplate: {
            type: "string",
          },
        },
      },
      kickoffEmail: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "body"],
        properties: {
          subject: {
            type: "string",
          },
          body: {
            type: "string",
          },
        },
      },
      teamsIntroMessage: {
        type: "string",
      },
      clickupTasks: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "owner", "priority"],
          properties: {
            title: {
              type: "string",
            },
            description: {
              type: "string",
            },
            owner: {
              type: "string",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
          },
        },
      },
    },
  },
} as const;

type AIOutputValidationSuccess = {
  success: true;
  data: AIOutput;
};

type AIOutputValidationFailure = {
  success: false;
  errors: string[];
};

export type AIOutputValidationResult =
  | AIOutputValidationSuccess
  | AIOutputValidationFailure;

export function validateAIOutput(input: unknown): AIOutputValidationResult {
  const validation = aiOutputSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.issues.map((issue) => issue.message),
    };
  }

  return {
    success: true,
    data: validation.data,
  };
}

export function extractJSONObject(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("```")) {
    const withoutOpeningFence = trimmedValue.replace(/^```(?:json)?\s*/i, "");
    return withoutOpeningFence.replace(/\s*```$/, "");
  }

  return trimmedValue;
}
