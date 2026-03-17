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

export function getIntegrationMetadata(kind: WorkflowIntegrationKind) {
  return buildIntegrationMetadata(kind);
}

export async function prepareEmailNotification(
  deal: Deal,
  enrichment: Pick<AIOutput, "kickoffEmail">
): Promise<EmailNotificationResult> {
  return {
    ...(await mockEmailNotification(deal, enrichment)),
    integration: buildIntegrationMetadata("email"),
  };
}

export async function moveSharepointFolder(
  deal: Deal
): Promise<SharepointResult> {
  return {
    ...(await mockSharepointMove(deal)),
    integration: buildIntegrationMetadata("sharepoint"),
  };
}

export async function createClickupProject(
  deal: Deal,
  enrichment: Pick<AIOutput, "clickupTasks" | "projectClassification">
): Promise<ClickupResult> {
  return {
    ...(await mockClickupProject(deal, enrichment)),
    integration: buildIntegrationMetadata("clickup"),
  };
}

export async function provisionTeamsWorkspace(
  deal: Deal,
  enrichment: Pick<AIOutput, "teamsIntroMessage">
): Promise<TeamsResult> {
  return {
    ...(await mockTeamsChannel(deal, enrichment)),
    integration: buildIntegrationMetadata("teams"),
  };
}
