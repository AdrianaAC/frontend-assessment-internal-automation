import type { AIOutput, SuggestedTask } from "@/types/ai-output";

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

const validLevels = new Set<AIOutput["projectClassification"]["complexity"]>([
  "low",
  "medium",
  "high",
]);

const validPriorities = new Set<SuggestedTask["priority"]>([
  "low",
  "medium",
  "high",
]);

function readRequiredString(
  value: unknown,
  label: string,
  errors: string[]
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} is required.`);
    return "";
  }

  return value.trim();
}

function readLevel(
  value: unknown,
  label: string,
  errors: string[]
): "low" | "medium" | "high" {
  if (typeof value !== "string" || !validLevels.has(value as never)) {
    errors.push(`${label} must be low, medium, or high.`);
    return "medium";
  }

  return value as "low" | "medium" | "high";
}

function readTask(task: unknown, index: number, errors: string[]): SuggestedTask {
  const taskLabel = `clickupTasks[${index}]`;

  if (!task || typeof task !== "object" || Array.isArray(task)) {
    errors.push(`${taskLabel} must be an object.`);
    return {
      title: "",
      description: "",
      owner: "",
      priority: "medium",
    };
  }

  const source = task as Record<string, unknown>;
  const priority = source.priority;

  if (typeof priority !== "string" || !validPriorities.has(priority as never)) {
    errors.push(`${taskLabel}.priority must be low, medium, or high.`);
  }

  return {
    title: readRequiredString(source.title, `${taskLabel}.title`, errors),
    description: readRequiredString(
      source.description,
      `${taskLabel}.description`,
      errors
    ),
    owner: readRequiredString(source.owner, `${taskLabel}.owner`, errors),
    priority:
      typeof priority === "string" && validPriorities.has(priority as never)
        ? (priority as SuggestedTask["priority"])
        : "medium",
  };
}

export function validateAIOutput(input: unknown): AIOutputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      errors: ["AI output must be an object."],
    };
  }

  const source = input as Record<string, unknown>;
  const errors: string[] = [];

  const projectClassification = source.projectClassification;
  const kickoffEmail = source.kickoffEmail;
  const teamsIntroMessage = readRequiredString(
    source.teamsIntroMessage,
    "teamsIntroMessage",
    errors
  );
  const clickupTasksSource = source.clickupTasks;

  if (
    !projectClassification ||
    typeof projectClassification !== "object" ||
    Array.isArray(projectClassification)
  ) {
    errors.push("projectClassification must be an object.");
  }

  if (!kickoffEmail || typeof kickoffEmail !== "object" || Array.isArray(kickoffEmail)) {
    errors.push("kickoffEmail must be an object.");
  }

  if (!Array.isArray(clickupTasksSource)) {
    errors.push("clickupTasks must be an array.");
  }

  const classificationSource =
    projectClassification && typeof projectClassification === "object"
      ? (projectClassification as Record<string, unknown>)
      : {};

  const kickoffEmailSource =
    kickoffEmail && typeof kickoffEmail === "object"
      ? (kickoffEmail as Record<string, unknown>)
      : {};

  const clickupTasks = Array.isArray(clickupTasksSource)
    ? clickupTasksSource.map((task, index) => readTask(task, index, errors))
    : [];

  const validatedProjectClassification = {
    projectType: readRequiredString(
      classificationSource.projectType,
      "projectClassification.projectType",
      errors
    ),
    complexity: readLevel(
      classificationSource.complexity,
      "projectClassification.complexity",
      errors
    ),
    riskLevel: readLevel(
      classificationSource.riskLevel,
      "projectClassification.riskLevel",
      errors
    ),
    recommendedTemplate: readRequiredString(
      classificationSource.recommendedTemplate,
      "projectClassification.recommendedTemplate",
      errors
    ),
  };

  const validatedKickoffEmail = {
    subject: readRequiredString(
      kickoffEmailSource.subject,
      "kickoffEmail.subject",
      errors
    ),
    body: readRequiredString(kickoffEmailSource.body, "kickoffEmail.body", errors),
  };

  if (clickupTasks.length === 0) {
    errors.push("clickupTasks must contain at least one task.");
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      projectClassification: validatedProjectClassification,
      kickoffEmail: validatedKickoffEmail,
      teamsIntroMessage,
      clickupTasks,
    },
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
