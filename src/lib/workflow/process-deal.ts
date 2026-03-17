import { runAIEnrichment } from "@/lib/ai/prompts";
import {
  mockClickupProject,
  mockEmailNotification,
  mockSharepointMove,
  mockTeamsChannel,
} from "@/lib/workflow/mocks";
import type { Deal } from "@/types/deal";
import type {
  ClickupResult,
  EmailNotificationResult,
  SharepointResult,
  TeamsResult,
  WorkflowExecutionStep,
  WorkflowResponse,
  WorkflowSystemStatus,
} from "@/types/workflow";

type StepRunResult<T> = {
  result: T;
  step: WorkflowExecutionStep;
};

function requiresApproval(options: {
  status: WorkflowSystemStatus;
  riskLevel?: "low" | "medium" | "high";
  mode?: "live" | "fallback";
}) {
  return (
    options.status === "error" ||
    options.mode === "fallback" ||
    options.riskLevel === "high"
  );
}

function buildEmailFailureResult(
  deal: Deal,
  errorMessage: string
): EmailNotificationResult {
  return {
    status: "error",
    provider: "Office365 / Outlook",
    recipients: [
      {
        name: deal.ownerName,
        address: deal.ownerEmail,
        role: "Sales Owner",
      },
      {
        name: deal.projectManagerName,
        address: deal.projectManagerEmail,
        role: "Project Manager",
      },
    ],
    subject: `Kickoff | ${deal.clientName} | ${deal.dealName}`,
    bodyPreview: "",
    payload: {
      message: {
        subject: `Kickoff | ${deal.clientName} | ${deal.dealName}`,
        body: {
          contentType: "Text",
          content: "",
        },
        toRecipients: [],
        ccRecipients: [],
        importance: "normal",
      },
      saveToSentItems: true,
    },
    message: `Outlook notification failed: ${errorMessage}`,
  };
}

function buildSharepointFailureResult(
  deal: Deal,
  errorMessage: string
): SharepointResult {
  return {
    status: "error",
    action: "move",
    sourceFolder: `/Propostas em Curso/${deal.clientName}`,
    destinationFolder: `/Projetos Ativos/${deal.clientName}`,
    message: `SharePoint provisioning failed: ${errorMessage}`,
  };
}

function buildClickupFailureResult(
  deal: Deal,
  errorMessage: string
): ClickupResult {
  return {
    status: "error",
    projectName: `${deal.clientName} - ${deal.dealName}`,
    space: "Operations",
    folder: "Active Projects",
    owner: deal.projectManagerName,
    startDate: deal.startDate ?? "TBD",
    value: `${deal.value} ${deal.currency}`,
    tags: [deal.serviceType],
    customFields: [],
    tasks: [],
    payload: {
      name: `${deal.clientName} - ${deal.dealName}`,
      space: "Operations",
      folder: "Active Projects",
      owner: deal.projectManagerName,
      startDate: deal.startDate ?? "TBD",
      tags: [deal.serviceType],
      customFields: [],
      tasks: [],
    },
    message: `ClickUp project creation failed: ${errorMessage}`,
  };
}

function buildTeamsFailureResult(
  deal: Deal,
  errorMessage: string
): TeamsResult {
  return {
    status: "error",
    teamName: `${deal.clientName} Delivery Team`,
    channelName: `${deal.clientName.toLowerCase().replaceAll(" ", "-")}-kickoff`,
    visibility: "private",
    members: [],
    owners: [],
    welcomeMessage: "",
    payload: {
      displayName: `${deal.clientName} Delivery Team`,
      description: `Project workspace for ${deal.dealName} (${deal.clientName}).`,
      visibility: "private",
      owners: [],
      members: [],
      channels: [],
    },
    message: `Teams provisioning failed: ${errorMessage}`,
  };
}

async function runWorkflowStep<T>(config: {
  id: string;
  title: string;
  retryable: boolean;
  approvalRequiredOnSuccess: boolean;
  approvalRequiredOnFailure: boolean;
  continuedAfterFailure: boolean;
  maxAttempts: number;
  run: () => Promise<T>;
  onSuccessDescription: (result: T) => string;
  onFailureResult: (errorMessage: string) => T;
}): Promise<StepRunResult<T>> {
  const startedAt = Date.now();
  let attempts = 0;
  let lastErrorMessage = "Unknown error.";

  while (attempts < config.maxAttempts) {
    attempts += 1;

    try {
      const result = await config.run();
      return {
        result,
        step: {
          id: config.id,
          title: config.title,
          status: "success",
          description: config.onSuccessDescription(result),
          durationMs: Date.now() - startedAt,
          attempts,
          retryable: config.retryable,
          approvalRequired: config.approvalRequiredOnSuccess,
          continuedAfterFailure: config.continuedAfterFailure,
        },
      };
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : "Unknown workflow step failure.";

      if (!config.retryable || attempts >= config.maxAttempts) {
        break;
      }
    }
  }

  return {
    result: config.onFailureResult(lastErrorMessage),
    step: {
      id: config.id,
      title: config.title,
      status: "error",
      description: `${config.title} failed, but the workflow continued where possible.`,
      durationMs: Date.now() - startedAt,
      attempts,
      retryable: config.retryable,
      approvalRequired: config.approvalRequiredOnFailure,
      continuedAfterFailure: config.continuedAfterFailure,
      errorMessage: lastErrorMessage,
    },
  };
}

export async function processDeal(deal: Deal): Promise<WorkflowResponse> {
  const workflowStartedAt = Date.now();
  const steps: WorkflowExecutionStep[] = [
    {
      id: "deal-received",
      title: "Deal Received",
      status: "success",
      description: `The won deal "${deal.dealName}" for ${deal.clientName} entered the automation workflow.`,
      durationMs: 0,
      attempts: 1,
      retryable: false,
      approvalRequired: false,
      continuedAfterFailure: false,
    },
  ];
  const aiStartedAt = Date.now();
  const enrichmentResult = await runAIEnrichment(deal);
  const enrichment = enrichmentResult.output;
  const aiStatus: WorkflowSystemStatus =
    enrichmentResult.mode === "live" ? "success" : "warning";
  const aiDescription =
    enrichmentResult.mode === "live"
      ? `AI enrichment completed using ${enrichmentResult.attempts} attempt(s) and generated project classification plus communication drafts.`
      : `AI enrichment fell back to deterministic output after ${enrichmentResult.attempts} attempt(s). Reason: ${enrichmentResult.failureReason ?? "unknown"}.`;

  steps.push({
    id: "ai-enrichment",
    title: "AI Enrichment",
    status: aiStatus,
    description: aiDescription,
    durationMs: Date.now() - aiStartedAt,
    attempts: enrichmentResult.attempts,
    retryable: true,
    approvalRequired: requiresApproval({
      status: aiStatus,
      riskLevel: enrichment.projectClassification.riskLevel,
      mode: enrichmentResult.mode,
    }),
    continuedAfterFailure: true,
    errorMessage:
      enrichmentResult.mode === "fallback"
        ? enrichmentResult.failureReason
        : undefined,
  });

  const [emailStep, sharepointStep, clickupStep, teamsStep] = await Promise.all([
    runWorkflowStep<EmailNotificationResult>({
      id: "email-notification",
      title: "Email Notification",
      retryable: true,
      approvalRequiredOnSuccess:
        enrichment.projectClassification.riskLevel === "high",
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => mockEmailNotification(deal, enrichment),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) => buildEmailFailureResult(deal, errorMessage),
    }),
    runWorkflowStep<SharepointResult>({
      id: "sharepoint-setup",
      title: "SharePoint Setup",
      retryable: true,
      approvalRequiredOnSuccess:
        enrichment.projectClassification.riskLevel === "high",
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => mockSharepointMove(deal),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) =>
        buildSharepointFailureResult(deal, errorMessage),
    }),
    runWorkflowStep<ClickupResult>({
      id: "clickup-project-creation",
      title: "ClickUp Project Creation",
      retryable: true,
      approvalRequiredOnSuccess:
        enrichment.projectClassification.riskLevel === "high",
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => mockClickupProject(deal, enrichment),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) => buildClickupFailureResult(deal, errorMessage),
    }),
    runWorkflowStep<TeamsResult>({
      id: "teams-channel-provisioning",
      title: "Teams Channel Provisioning",
      retryable: true,
      approvalRequiredOnSuccess:
        enrichment.projectClassification.riskLevel === "high",
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => mockTeamsChannel(deal, enrichment),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) => buildTeamsFailureResult(deal, errorMessage),
    }),
  ]);

  steps.push(emailStep.step, sharepointStep.step, clickupStep.step, teamsStep.step);

  const executionStatus =
    steps.some((step) => step.status === "error")
      ? ("error" as const)
      : steps.some((step) => step.status === "warning")
        ? ("warning" as const)
        : ("success" as const);

  return {
    deal,
    enrichment,
    execution: {
      status: executionStatus,
      totalDurationMs: Date.now() - workflowStartedAt,
      steps,
    },
    systems: {
      email: emailStep.result,
      sharepoint: sharepointStep.result,
      clickup: clickupStep.result,
      teams: teamsStep.result,
    },
  };
}
