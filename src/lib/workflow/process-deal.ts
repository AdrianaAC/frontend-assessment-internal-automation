import { runAIEnrichment } from "@/lib/ai/prompts";
import {
  buildChannelSlug,
  normalizeEmailAddress,
  sanitizeDisplayName,
  sanitizePathSegment,
} from "@/lib/normalization/deal-normalization";
import {
  getErrorDetails,
  logInfo,
  logWarn,
  type CorrelationContext,
} from "@/lib/observability/logger";
import {
  createClickupProject,
  getIntegrationMetadata,
  moveSharepointFolder,
  prepareEmailNotification,
  provisionTeamsWorkspace,
} from "@/lib/workflow/integrations";
import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";
import type {
  ClickupResult,
  EmailNotificationResult,
  SharepointResult,
  TeamsResult,
  WorkflowAIExecutionContext,
  WorkflowApprovalState,
  WorkflowExecutionStep,
  WorkflowResponse,
  WorkflowSystemStatus,
} from "@/types/workflow";

type WorkflowApprovalDecision = {
  approvedBy: string;
  notes?: string;
  approvedAt?: string;
};

type ProcessDealOptions = {
  enrichmentContext?: WorkflowAIExecutionContext & {
    output?: AIOutput;
  };
  enrichmentOverride?: AIOutput;
  approvalDecision?: WorkflowApprovalDecision;
  observability?: Partial<CorrelationContext>;
};

type StepRunResult<T> = {
  result: T;
  step: WorkflowExecutionStep;
};

// Decides whether this workflow should pause for a human check before provisioning.
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

// Removes duplicate recipients so each email address is used only once.
function dedupeRecipients<T extends { address: string }>(recipients: T[]) {
  return recipients.filter((recipient, index, allRecipients) => {
    const normalizedAddress = normalizeEmailAddress(recipient.address);

    return (
      normalizedAddress.length > 0 &&
      allRecipients.findIndex(
        (candidate) =>
          normalizeEmailAddress(candidate.address) === normalizedAddress
      ) === index
    );
  });
}

// Builds a safe SharePoint folder name from the client name.
function buildClientFolderName(clientName: string) {
  return sanitizePathSegment(clientName);
}

// Builds the display name for the Teams workspace.
function buildTeamName(clientName: string) {
  return sanitizeDisplayName(`${clientName} Delivery Team`, "Delivery Team");
}

// Builds the kickoff channel name that will be created in Teams.
function buildKickoffChannelName(clientName: string) {
  return buildChannelSlug(clientName, "kickoff");
}

// Collects the people who should receive the kickoff email.
function buildNotificationRecipients(deal: Deal) {
  return dedupeRecipients([
    {
      name: deal.ownerName,
      address: deal.ownerEmail,
      role: "Sales Owner",
    },
    {
      name: deal.financeName,
      address: deal.financeEmail,
      role: "Finance",
    },
    {
      name: deal.projectManagerName,
      address: deal.projectManagerEmail,
      role: "Project Manager",
    },
    {
      name: deal.sponsorName,
      address: deal.sponsorEmail,
      role: "Sponsor",
    },
    {
      name: deal.consultantName,
      address: deal.consultantEmail,
      role: "Consultant",
    },
    {
      name: deal.juniorConsultantName,
      address: deal.juniorConsultantEmail,
      role: "Junior Consultant",
    },
  ]);
}

// Collects the people who should be added to the delivery workspace.
function buildDeliveryTeamMembers(deal: Deal) {
  return dedupeRecipients([
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
    {
      name: deal.sponsorName,
      address: deal.sponsorEmail,
      role: "Sponsor",
    },
    {
      name: deal.consultantName,
      address: deal.consultantEmail,
      role: "Consultant",
    },
    {
      name: deal.juniorConsultantName,
      address: deal.juniorConsultantEmail,
      role: "Junior Consultant",
    },
  ]);
}

// Calculates a future date for task planning when a valid start date exists.
function addDays(startDate: string | undefined, daysToAdd: number) {
  if (!startDate) {
    return "TBD";
  }

  const date = new Date(`${startDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

// Explains why this run needs human review before continuing.
function buildApprovalReason(
  context: WorkflowAIExecutionContext,
  riskLevel: "low" | "medium" | "high"
) {
  const reasons: string[] = [];

  if (context.mode === "fallback") {
    reasons.push("AI enrichment fell back to deterministic output");
  }

  if (riskLevel === "high") {
    reasons.push("the project was classified as high risk");
  }

  return reasons.join(" and ");
}

// Creates the approval state shown while the workflow is waiting for review.
function buildApprovalPendingState(
  reason: string
): Extract<WorkflowApprovalState, { status: "pending" }> {
  return {
    status: "pending",
    stage: "pre-provisioning",
    reason,
  };
}

// Creates the approval state shown after a reviewer has allowed the workflow to continue.
function buildApprovalApprovedState(
  reason: string,
  decision: WorkflowApprovalDecision
): Extract<WorkflowApprovalState, { status: "approved" }> {
  return {
    status: "approved",
    stage: "pre-provisioning",
    reason,
    approvedBy: decision.approvedBy,
    approvedAt: decision.approvedAt ?? new Date().toISOString(),
    notes: decision.notes,
  };
}

// Builds the fallback email result shown when the email step fails.
function buildEmailFailureResult(
  deal: Deal,
  errorMessage: string
): EmailNotificationResult {
  return {
    status: "error",
    integration: getIntegrationMetadata("email"),
    provider: "Office365 / Outlook",
    recipients: buildNotificationRecipients(deal),
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

// Builds the email payload preview that is shown while approval is still pending.
function buildPendingEmailResult(
  deal: Deal,
  enrichment: AIOutput
): EmailNotificationResult {
  const recipients = buildNotificationRecipients(deal);
  const [primaryRecipient, ...ccRecipients] = recipients;

  return {
    status: "pending",
    integration: getIntegrationMetadata("email"),
    provider: "Office365 / Outlook",
    recipients,
    subject: enrichment.kickoffEmail.subject,
    bodyPreview: enrichment.kickoffEmail.body,
    payload: {
      message: {
        subject: enrichment.kickoffEmail.subject,
        body: {
          contentType: "Text",
          content: enrichment.kickoffEmail.body,
        },
        toRecipients: primaryRecipient
          ? [
              {
                emailAddress: {
                  name: primaryRecipient.name,
                  address: primaryRecipient.address,
                },
              },
            ]
          : [],
        ccRecipients: ccRecipients.map((recipient) => ({
          emailAddress: {
            name: recipient.name,
            address: recipient.address,
          },
        })),
        importance: "normal",
      },
      saveToSentItems: true,
    },
    message: "Email draft is ready and waiting for human approval before send.",
  };
}

// Builds the fallback SharePoint result shown when folder provisioning fails.
function buildSharepointFailureResult(
  deal: Deal,
  errorMessage: string
): SharepointResult {
  return {
    status: "error",
    integration: getIntegrationMetadata("sharepoint"),
    action: "move",
    sourceFolder: `/Propostas em Curso/${buildClientFolderName(deal.clientName)}`,
    destinationFolder: `/Projetos Ativos/${buildClientFolderName(deal.clientName)}`,
    message: `SharePoint provisioning failed: ${errorMessage}`,
  };
}

// Builds the SharePoint move preview that is shown while approval is still pending.
function buildPendingSharepointResult(deal: Deal): SharepointResult {
  return {
    status: "pending",
    integration: getIntegrationMetadata("sharepoint"),
    action: "move",
    sourceFolder: `/Propostas em Curso/${buildClientFolderName(deal.clientName)}`,
    destinationFolder: `/Projetos Ativos/${buildClientFolderName(deal.clientName)}`,
    message: "SharePoint move is queued and waiting for human approval.",
  };
}

// Builds the fallback ClickUp result shown when project creation fails.
function buildClickupFailureResult(
  deal: Deal,
  errorMessage: string
): ClickupResult {
  return {
    status: "error",
    integration: getIntegrationMetadata("clickup"),
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

// Builds the ClickUp project preview that is shown while approval is still pending.
function buildPendingClickupResult(
  deal: Deal,
  enrichment: AIOutput
): ClickupResult {
  const tags = [
    deal.serviceType,
    enrichment.projectClassification.complexity,
    enrichment.projectClassification.riskLevel,
  ];
  const customFields = [
    {
      name: "Client",
      value: deal.clientName,
    },
    {
      name: "Deal Value",
      value: `${deal.value} ${deal.currency}`,
    },
    {
      name: "Project Manager",
      value: deal.projectManagerName,
    },
    {
      name: "Sponsor",
      value: deal.sponsorName,
    },
    {
      name: "Template",
      value: enrichment.projectClassification.recommendedTemplate,
    },
  ];
  const tasks = enrichment.clickupTasks.map((task, index) => ({
    title: task.title,
    description: task.description,
    owner: task.owner,
    priority: task.priority,
    startDate: deal.startDate ?? "TBD",
    dueDate: addDays(deal.startDate, index + 2),
    tags: [deal.serviceType, task.priority],
  }));

  return {
    status: "pending",
    integration: getIntegrationMetadata("clickup"),
    projectName: `${deal.clientName} - ${deal.dealName}`,
    space: "Operations",
    folder: "Active Projects",
    owner: deal.projectManagerName,
    startDate: deal.startDate ?? "TBD",
    value: `${deal.value} ${deal.currency}`,
    tags,
    customFields,
    tasks,
    payload: {
      name: `${deal.clientName} - ${deal.dealName}`,
      space: "Operations",
      folder: "Active Projects",
      owner: deal.projectManagerName,
      startDate: deal.startDate ?? "TBD",
      tags,
      customFields,
      tasks,
    },
    message: "ClickUp payload is prepared and waiting for human approval.",
  };
}

// Builds the fallback Teams result shown when workspace provisioning fails.
function buildTeamsFailureResult(
  deal: Deal,
  errorMessage: string
): TeamsResult {
  return {
    status: "error",
    integration: getIntegrationMetadata("teams"),
    teamName: buildTeamName(deal.clientName),
    channelName: buildKickoffChannelName(deal.clientName),
    visibility: "private",
    members: [],
    owners: [],
    welcomeMessage: "",
    payload: {
      displayName: buildTeamName(deal.clientName),
      description: `Project workspace for ${deal.dealName} (${deal.clientName}).`,
      visibility: "private",
      owners: [],
      members: [],
      channels: [],
    },
    message: `Teams provisioning failed: ${errorMessage}`,
  };
}

// Builds the Teams workspace preview that is shown while approval is still pending.
function buildPendingTeamsResult(deal: Deal, enrichment: AIOutput): TeamsResult {
  const members = buildDeliveryTeamMembers(deal);
  const owners = members.filter(
    (member) =>
      member.role === "Project Manager" || member.role === "Sales Owner"
  );

  return {
    status: "pending",
    integration: getIntegrationMetadata("teams"),
    teamName: buildTeamName(deal.clientName),
    channelName: buildKickoffChannelName(deal.clientName),
    visibility: "private",
    members,
    owners,
    welcomeMessage: enrichment.teamsIntroMessage,
    payload: {
      displayName: buildTeamName(deal.clientName),
      description: `Project workspace for ${deal.dealName} (${deal.clientName}).`,
      visibility: "private",
      owners: owners.map((owner) => ({
        userPrincipalName: owner.address,
        displayName: owner.name,
      })),
      members: members.map((member) => ({
        userPrincipalName: member.address,
        displayName: member.name,
        role: member.role,
      })),
      channels: [
        {
          displayName: buildKickoffChannelName(deal.clientName),
          membershipType: "standard",
          welcomeMessage: enrichment.teamsIntroMessage,
        },
      ],
    },
    message: "Teams workspace payload is prepared and waiting for human approval.",
  };
}

// Runs one workflow step with retry handling and records its outcome for the timeline.
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
  observability?: Record<string, unknown>;
}): Promise<StepRunResult<T>> {
  const startedAt = Date.now();
  let attempts = 0;
  let lastErrorMessage = "Unknown error.";

  logInfo("workflow.step.started", {
    ...config.observability,
    stepId: config.id,
    stepTitle: config.title,
    retryable: config.retryable,
    maxAttempts: config.maxAttempts,
  });

  while (attempts < config.maxAttempts) {
    attempts += 1;

    try {
      const result = await config.run();
      const durationMs = Date.now() - startedAt;

      logInfo("workflow.step.completed", {
        ...config.observability,
        stepId: config.id,
        stepTitle: config.title,
        status: "success",
        attempts,
        durationMs,
      });

      return {
        result,
        step: {
          id: config.id,
          title: config.title,
          status: "success",
          description: config.onSuccessDescription(result),
          durationMs,
          attempts,
          retryable: config.retryable,
          approvalRequired: config.approvalRequiredOnSuccess,
          continuedAfterFailure: config.continuedAfterFailure,
        },
      };
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : "Unknown workflow step failure.";

      logWarn("workflow.step.attempt_failed", {
        ...config.observability,
        stepId: config.id,
        stepTitle: config.title,
        attempt: attempts,
        maxAttempts: config.maxAttempts,
        error: getErrorDetails(error),
        durationMs: Date.now() - startedAt,
      });

      if (!config.retryable || attempts >= config.maxAttempts) {
        break;
      }
    }
  }

  const durationMs = Date.now() - startedAt;

  logWarn("workflow.step.completed", {
    ...config.observability,
    stepId: config.id,
    stepTitle: config.title,
    status: "error",
    attempts,
    durationMs,
    errorMessage: lastErrorMessage,
  });

  return {
    result: config.onFailureResult(lastErrorMessage),
    step: {
      id: config.id,
      title: config.title,
      status: "error",
      description: `${config.title} failed, but the workflow continued where possible.`,
      durationMs,
      attempts,
      retryable: config.retryable,
      approvalRequired: config.approvalRequiredOnFailure,
      continuedAfterFailure: config.continuedAfterFailure,
      errorMessage: lastErrorMessage,
    },
  };
}

// Orchestrates the full won-deal workflow from AI enrichment through downstream systems.
export async function processDeal(
  deal: Deal,
  options: ProcessDealOptions = {}
): Promise<WorkflowResponse> {
  const workflowStartedAt = Date.now();
  const observabilityContext = {
    correlationId: options.observability?.correlationId,
    route: options.observability?.route,
    workflowRunId: options.observability?.workflowRunId,
    sourceEventId: options.observability?.sourceEventId,
    dealId: deal.dealId,
    clientName: deal.clientName,
  };

  logInfo("workflow.execution.started", observabilityContext);
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
  const generatedEnrichmentContext =
    options.enrichmentContext && options.enrichmentOverride
      ? {
          mode: options.enrichmentContext.mode,
          attempts: options.enrichmentContext.attempts,
          failureReason: options.enrichmentContext.failureReason,
          output: options.enrichmentOverride,
        }
      : await runAIEnrichment(deal, options.observability);
  const enrichment = options.enrichmentOverride ?? generatedEnrichmentContext.output;
  const enrichmentContext: WorkflowAIExecutionContext = {
    mode: generatedEnrichmentContext.mode,
    attempts: generatedEnrichmentContext.attempts,
    failureReason: generatedEnrichmentContext.failureReason,
  };
  const aiStatus: WorkflowSystemStatus =
    enrichmentContext.mode === "live" ? "success" : "warning";
  const aiDescription =
    enrichmentContext.mode === "live"
      ? `AI enrichment completed using ${enrichmentContext.attempts} attempt(s) and generated project classification plus communication drafts.`
      : `AI enrichment fell back to deterministic output after ${enrichmentContext.attempts} attempt(s). Reason: ${enrichmentContext.failureReason ?? "unknown"}.`;
  const approvalReason = buildApprovalReason(
    enrichmentContext,
    enrichment.projectClassification.riskLevel
  );
  const approvalIsRequired =
    requiresApproval({
      status: aiStatus,
      riskLevel: enrichment.projectClassification.riskLevel,
      mode: enrichmentContext.mode,
    }) && approvalReason.length > 0;

  steps.push({
    id: "ai-enrichment",
    title: "AI Enrichment",
    status: aiStatus,
    description: aiDescription,
    durationMs: Date.now() - aiStartedAt,
    attempts: enrichmentContext.attempts,
    retryable: true,
    approvalRequired: approvalIsRequired,
    continuedAfterFailure: true,
    errorMessage:
      enrichmentContext.mode === "fallback"
        ? enrichmentContext.failureReason
        : undefined,
  });

  logInfo("workflow.ai_enrichment.completed", {
    ...observabilityContext,
    mode: enrichmentContext.mode,
    attempts: enrichmentContext.attempts,
    failureReason: enrichmentContext.failureReason,
    riskLevel: enrichment.projectClassification.riskLevel,
    complexity: enrichment.projectClassification.complexity,
    durationMs: Date.now() - aiStartedAt,
    approvalRequired: approvalIsRequired,
  });

  if (approvalIsRequired && !options.approvalDecision) {
    steps.push({
      id: "human-approval",
      title: "Human Approval",
      status: "pending",
      description: `Workflow paused before downstream provisioning because ${approvalReason}.`,
      durationMs: 0,
      attempts: 0,
      retryable: false,
      approvalRequired: true,
      continuedAfterFailure: false,
    });

    logWarn("workflow.execution.paused_for_approval", {
      ...observabilityContext,
      reason: approvalReason,
      totalDurationMs: Date.now() - workflowStartedAt,
    });

    return {
      deal,
      enrichment,
      enrichmentContext,
      approval: buildApprovalPendingState(approvalReason),
      execution: {
        status: "pending",
        totalDurationMs: Date.now() - workflowStartedAt,
        steps,
      },
      systems: {
        email: buildPendingEmailResult(deal, enrichment),
        sharepoint: buildPendingSharepointResult(deal),
        clickup: buildPendingClickupResult(deal, enrichment),
        teams: buildPendingTeamsResult(deal, enrichment),
      },
    };
  }

  const approvalState: WorkflowApprovalState =
    approvalIsRequired && options.approvalDecision
      ? buildApprovalApprovedState(approvalReason, options.approvalDecision)
      : {
          status: "not_required",
        };

  if (approvalState.status === "approved") {
    logInfo("workflow.execution.approval_received", {
      ...observabilityContext,
      approvedBy: approvalState.approvedBy,
      approvedAt: approvalState.approvedAt,
    });

    steps.push({
      id: "human-approval",
      title: "Human Approval",
      status: "success",
      description: `Workflow resumed by ${approvalState.approvedBy}.`,
      durationMs: 0,
      attempts: 1,
      retryable: false,
      approvalRequired: false,
      continuedAfterFailure: false,
    });
  }

  const [emailStep, sharepointStep, clickupStep, teamsStep] = await Promise.all([
    runWorkflowStep<EmailNotificationResult>({
      id: "email-notification",
      title: "Email Notification",
      retryable: true,
      approvalRequiredOnSuccess: false,
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => prepareEmailNotification(deal, enrichment),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) => buildEmailFailureResult(deal, errorMessage),
      observability: observabilityContext,
    }),
    runWorkflowStep<SharepointResult>({
      id: "sharepoint-setup",
      title: "SharePoint Setup",
      retryable: true,
      approvalRequiredOnSuccess: false,
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => moveSharepointFolder(deal),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) =>
        buildSharepointFailureResult(deal, errorMessage),
      observability: observabilityContext,
    }),
    runWorkflowStep<ClickupResult>({
      id: "clickup-project-creation",
      title: "ClickUp Project Creation",
      retryable: true,
      approvalRequiredOnSuccess: false,
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => createClickupProject(deal, enrichment),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) => buildClickupFailureResult(deal, errorMessage),
      observability: observabilityContext,
    }),
    runWorkflowStep<TeamsResult>({
      id: "teams-channel-provisioning",
      title: "Teams Channel Provisioning",
      retryable: true,
      approvalRequiredOnSuccess: false,
      approvalRequiredOnFailure: true,
      continuedAfterFailure: true,
      maxAttempts: 2,
      run: () => provisionTeamsWorkspace(deal, enrichment),
      onSuccessDescription: (result) => result.message,
      onFailureResult: (errorMessage) => buildTeamsFailureResult(deal, errorMessage),
      observability: observabilityContext,
    }),
  ]);

  steps.push(emailStep.step, sharepointStep.step, clickupStep.step, teamsStep.step);

  const executionStatus =
    steps.some((step) => step.status === "error")
      ? ("error" as const)
      : steps.some((step) => step.status === "warning")
        ? ("warning" as const)
        : ("success" as const);

  const systemStatuses = {
    email: emailStep.result.status,
    sharepoint: sharepointStep.result.status,
    clickup: clickupStep.result.status,
    teams: teamsStep.result.status,
  };

  if (executionStatus === "error" || executionStatus === "warning") {
    logWarn("workflow.execution.completed", {
      ...observabilityContext,
      executionStatus,
      totalDurationMs: Date.now() - workflowStartedAt,
      systemStatuses,
    });
  } else {
    logInfo("workflow.execution.completed", {
      ...observabilityContext,
      executionStatus,
      totalDurationMs: Date.now() - workflowStartedAt,
      systemStatuses,
    });
  }

  return {
    deal,
    enrichment,
    enrichmentContext,
    approval: approvalState,
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
