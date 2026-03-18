import {
  mockClickupProject,
  mockEmailNotification,
  mockSharepointMove,
  mockTeamsChannel,
} from "@/lib/workflow/mocks";
import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";
import type {
  ClickupResult,
  EmailNotificationResult,
  SharepointResult,
  TeamsResult,
  WorkflowIntegrationKind,
  WorkflowIntegrationMetadata,
} from "@/types/workflow";

// Returns the descriptive integration metadata shown alongside each simulated system.
function buildIntegrationMetadata(
  kind: WorkflowIntegrationKind
): WorkflowIntegrationMetadata {
  const catalog: Record<WorkflowIntegrationKind, WorkflowIntegrationMetadata> = {
    email: {
      kind: "email",
      mode: "mock",
      implementation: "simulated",
      provider: "Office365 / Outlook",
      liveEquivalent: "Microsoft Graph sendMail",
      note: "Simulated payload only. No live email was sent.",
    },
    sharepoint: {
      kind: "sharepoint",
      mode: "mock",
      implementation: "simulated",
      provider: "SharePoint Online",
      liveEquivalent: "Microsoft Graph / SharePoint REST",
      note: "Simulated folder move only. No live document operation was executed.",
    },
    clickup: {
      kind: "clickup",
      mode: "mock",
      implementation: "simulated",
      provider: "ClickUp",
      liveEquivalent: "ClickUp API",
      note: "Simulated project provisioning only. No live ClickUp resources were created.",
    },
    teams: {
      kind: "teams",
      mode: "mock",
      implementation: "simulated",
      provider: "Microsoft Teams",
      liveEquivalent: "Microsoft Graph groups / teams / channels",
      note: "Simulated team provisioning only. No live Teams workspace was created.",
    },
  };

  return catalog[kind];
}

// Exposes integration metadata to the rest of the workflow.
export function getIntegrationMetadata(kind: WorkflowIntegrationKind) {
  return buildIntegrationMetadata(kind);
}

// Prepares the simulated Outlook notification result for this deal.
export async function prepareEmailNotification(
  deal: Deal,
  enrichment: Pick<AIOutput, "kickoffEmail">
): Promise<EmailNotificationResult> {
  return {
    ...(await mockEmailNotification(deal, enrichment)),
    integration: buildIntegrationMetadata("email"),
  };
}

// Prepares the simulated SharePoint move result for this deal.
export async function moveSharepointFolder(
  deal: Deal
): Promise<SharepointResult> {
  return {
    ...(await mockSharepointMove(deal)),
    integration: buildIntegrationMetadata("sharepoint"),
  };
}

// Prepares the simulated ClickUp project result for this deal.
export async function createClickupProject(
  deal: Deal,
  enrichment: Pick<AIOutput, "clickupTasks" | "projectClassification">
): Promise<ClickupResult> {
  return {
    ...(await mockClickupProject(deal, enrichment)),
    integration: buildIntegrationMetadata("clickup"),
  };
}

// Prepares the simulated Teams provisioning result for this deal.
export async function provisionTeamsWorkspace(
  deal: Deal,
  enrichment: Pick<AIOutput, "teamsIntroMessage">
): Promise<TeamsResult> {
  return {
    ...(await mockTeamsChannel(deal, enrichment)),
    integration: buildIntegrationMetadata("teams"),
  };
}
