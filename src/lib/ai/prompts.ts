import { getOpenAIClient } from "./openai";
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

function logAIEvent(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>
) {
  console[level](`[ai-enrichment] ${message}`, context);
}

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

function normalizeAIResponseContent(content: string) {
  return extractJSONObject(content)
    .replace(/\u2014/g, "-")
    .replace(/\u2019/g, "'")
    .trim();
}

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

export async function runAIEnrichment(deal: Deal): Promise<AIEnrichmentResult> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    logAIEvent("info", "Using deterministic fallback because AI credentials are missing.", {
      promptVersion: AI_PROMPT_VERSION,
      dealId: deal.dealId,
      model: process.env.OPENAI_MODEL ?? null,
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
        logAIEvent("warn", "AI response was empty.", {
          promptVersion: AI_PROMPT_VERSION,
          dealId: deal.dealId,
          model: process.env.OPENAI_MODEL,
          attempt,
        });
        continue;
      }

      let parsedContent: unknown;

      try {
        parsedContent = JSON.parse(normalizeAIResponseContent(content)) as unknown;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to parse JSON.";
        lastFailureReason = "json_parse_failed";
        logAIEvent("warn", "AI response could not be parsed as JSON.", {
          promptVersion: AI_PROMPT_VERSION,
          dealId: deal.dealId,
          model: process.env.OPENAI_MODEL,
          attempt,
          error: errorMessage,
          contentPreview: content.slice(0, 300),
        });
        continue;
      }

      const validation = validateAIOutput(parsedContent);

      if (!validation.success) {
        lastFailureReason = "schema_validation_failed";
        logAIEvent("warn", "AI output validation failed.", {
          promptVersion: AI_PROMPT_VERSION,
          dealId: deal.dealId,
          model: process.env.OPENAI_MODEL,
          attempt,
          errors: validation.errors,
        });
        continue;
      }

      logAIEvent("info", "AI enrichment completed successfully.", {
        promptVersion: AI_PROMPT_VERSION,
        dealId: deal.dealId,
        model: process.env.OPENAI_MODEL,
        attempt,
      });

      return {
        output: validation.data,
        mode: "live",
        attempts: attempt,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown AI request failure.";
      lastFailureReason = "request_failed";
      logAIEvent("warn", "AI enrichment attempt failed.", {
        promptVersion: AI_PROMPT_VERSION,
        dealId: deal.dealId,
        model: process.env.OPENAI_MODEL,
        attempt,
        error: errorMessage,
      });
    }
  }

  logAIEvent("error", "Falling back after AI enrichment failure.", {
    promptVersion: AI_PROMPT_VERSION,
    dealId: deal.dealId,
    model: process.env.OPENAI_MODEL,
    attempts: AI_MAX_ATTEMPTS,
    reason: lastFailureReason,
  });

  return {
    output: buildFallbackOutput(deal),
    mode: "fallback",
    attempts: AI_MAX_ATTEMPTS,
    failureReason: lastFailureReason,
  };
}

export async function enrichDealWithAI(deal: Deal): Promise<AIOutput> {
  const result = await runAIEnrichment(deal);
  return result.output;
}
