import { getOpenAIClient } from "./openai";
import {
  getErrorDetails,
  logError,
  logInfo,
  logWarn,
  type CorrelationContext,
} from "@/lib/observability/logger";
import {
  aiOutputJsonSchema,
  extractJSONObject,
  validateAIOutput,
} from "@/lib/validations/ai-output-schema";
import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";

const AI_PROMPT_VERSION = "workflow-enrichment-v4";
const AI_MAX_ATTEMPTS = 2;
const AI_SYSTEM_PROMPT = [
  "You are an enterprise automation AI.",
  "Generate only the workflow enrichment payload.",
  "Return valid JSON that matches the provided schema.",
  "Do not include markdown fences or commentary.",
].join(" ");

// Builds the user prompt that asks the model to enrich a won deal.
function createPrompt(deal: Deal) {
  return `
Prompt version: ${AI_PROMPT_VERSION}

You are enriching a consulting deal that has just transitioned to WON.

Produce structured output for:
- project classification
- kickoff email
- Teams intro message
- starter ClickUp tasks

The output will be consumed by internal automation systems, so it must be concise, practical, and production-appropriate.
The kickoff email audience includes sales, project manager, finance, sponsor, and the delivery team.
The Teams intro message must reference only the actual Teams workspace members: sales owner, sponsor, project manager, consultant, and junior consultant.

Deal:
${JSON.stringify(deal, null, 2)}
`;
}

// Cleans model output so it can be parsed as JSON reliably.
function normalizeAIResponseContent(content: string) {
  return extractJSONObject(content)
    .replace(/\u2014/g, "-")
    .replace(/\u2019/g, "'")
    .trim();
}

// Creates a deterministic enrichment payload when live AI is unavailable.
function buildFallbackOutput(deal: Deal): AIOutput {
  return {
    projectClassification: {
      projectType: deal.serviceType,
      complexity: deal.value >= 20000 ? "high" : "medium",
      riskLevel: deal.value >= 30000 ? "high" : "medium",
      recommendedTemplate:
        deal.serviceType === "implementation"
          ? "Implementation Kickoff Template"
          : "Standard Delivery Template",
    },
    kickoffEmail: {
      subject: `Kickoff | ${deal.clientName} | ${deal.dealName}`,
      body: `Hello team,

A new deal has been marked as won.

Client: ${deal.clientName}
Project: ${deal.dealName}
Value: ${deal.value} ${deal.currency}
Sales Owner: ${deal.ownerName}
Project Manager: ${deal.projectManagerName}
Finance Contact: ${deal.financeName}
Start Date: ${deal.startDate ?? "TBD"}

Next steps:
- Prepare SharePoint structure
- Create ClickUp project
- Add project team to Teams
- Schedule kickoff meeting

Notes:
${deal.notes ?? "No additional notes."}

Best regards,
Automation Bot`,
    },
    teamsIntroMessage: `Welcome everyone - this project for ${deal.clientName} is now starting.

Team:
- Sales Owner: ${deal.ownerName}
- Sponsor: ${deal.sponsorName}
- Project Manager: ${deal.projectManagerName}
- Consultant: ${deal.consultantName}
- Junior Consultant: ${deal.juniorConsultantName}

Main focus:
${deal.notes ?? "No additional notes."}

Let's use this channel for kickoff coordination and early project alignment.`,
    clickupTasks: [
      {
        title: "Create kickoff meeting",
        description: "Schedule the internal and client kickoff sessions.",
        owner: deal.projectManagerName,
        priority: "high",
      },
      {
        title: "Prepare SharePoint workspace",
        description: "Move proposal folder to active projects and validate structure.",
        owner: deal.consultantName,
        priority: "high",
      },
      {
        title: "Confirm project staffing",
        description: "Validate sponsor, PM, finance, consultant, and junior consultant allocation.",
        owner: deal.ownerName,
        priority: "medium",
      },
    ],
  };
}

export type AIEnrichmentResult = {
  output: AIOutput;
  mode: "live" | "fallback";
  attempts: number;
  failureReason?: string;
};

// Collects the tracing details that should travel with AI logs.
function buildAIContext(
  deal: Deal,
  correlation: Partial<CorrelationContext> | undefined
) {
  return {
    correlationId: correlation?.correlationId,
    route: correlation?.route,
    workflowRunId: correlation?.workflowRunId,
    sourceEventId: correlation?.sourceEventId,
    dealId: deal.dealId,
    promptVersion: AI_PROMPT_VERSION,
    model: process.env.OPENAI_MODEL ?? null,
  };
}

// Runs AI enrichment with retries and falls back to a safe deterministic payload on failure.
export async function runAIEnrichment(
  deal: Deal,
  correlation?: Partial<CorrelationContext>
): Promise<AIEnrichmentResult> {
  const startedAt = Date.now();
  const baseContext = buildAIContext(deal, correlation);

  logInfo("ai.enrichment.started", baseContext);

  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    logInfo("ai.enrichment.fallback", {
      ...baseContext,
      durationMs: Date.now() - startedAt,
      attempts: 0,
      fallbackReason: "missing_credentials",
    });
    return {
      output: buildFallbackOutput(deal),
      mode: "fallback",
      attempts: 0,
      failureReason: "missing_credentials",
    };
  }

  const openai = getOpenAIClient();
  const prompt = createPrompt(deal);
  let lastFailureReason = "unknown";

  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: AI_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: aiOutputJsonSchema,
        } as never,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        lastFailureReason = "empty_response";
        logWarn("ai.enrichment.attempt_failed", {
          ...baseContext,
          attempt,
          failureReason: lastFailureReason,
          durationMs: Date.now() - startedAt,
        });
        continue;
      }

      let parsedContent: unknown;

      try {
        parsedContent = JSON.parse(normalizeAIResponseContent(content)) as unknown;
      } catch (error) {
        lastFailureReason = "json_parse_failed";
        logWarn("ai.enrichment.attempt_failed", {
          ...baseContext,
          attempt,
          failureReason: lastFailureReason,
          error: getErrorDetails(error),
          contentPreview: content.slice(0, 300),
          durationMs: Date.now() - startedAt,
        });
        continue;
      }

      const validation = validateAIOutput(parsedContent);

      if (!validation.success) {
        lastFailureReason = "schema_validation_failed";
        logWarn("ai.enrichment.attempt_failed", {
          ...baseContext,
          attempt,
          failureReason: lastFailureReason,
          validationErrors: validation.errors,
          durationMs: Date.now() - startedAt,
        });
        continue;
      }

      logInfo("ai.enrichment.completed", {
        ...baseContext,
        attempt,
        mode: "live",
        durationMs: Date.now() - startedAt,
      });

      return {
        output: validation.data,
        mode: "live",
        attempts: attempt,
      };
    } catch (error) {
      lastFailureReason = "request_failed";
      logWarn("ai.enrichment.attempt_failed", {
        ...baseContext,
        attempt,
        failureReason: lastFailureReason,
        error: getErrorDetails(error),
        durationMs: Date.now() - startedAt,
      });
    }
  }

  logError("ai.enrichment.fallback", {
    ...baseContext,
    attempts: AI_MAX_ATTEMPTS,
    mode: "fallback",
    fallbackReason: lastFailureReason,
    durationMs: Date.now() - startedAt,
  });

  return {
    output: buildFallbackOutput(deal),
    mode: "fallback",
    attempts: AI_MAX_ATTEMPTS,
    failureReason: lastFailureReason,
  };
}

// Returns only the AI enrichment output when the caller does not need execution metadata.
export async function enrichDealWithAI(
  deal: Deal,
  correlation?: Partial<CorrelationContext>
): Promise<AIOutput> {
  const result = await runAIEnrichment(deal, correlation);
  return result.output;
}
