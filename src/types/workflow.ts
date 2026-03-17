import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";

export type WorkflowSystemStatus = "success" | "error" | "warning" | "pending";

export type WorkflowExecutionSummaryStatus =
  | "success"
  | "warning"
  | "error"
  | "pending";

export type WorkflowAIExecutionContext = {
  mode: "live" | "fallback";
  attempts: number;
  failureReason?: string;
};

export type WorkflowIntegrationKind =
  | "email"
  | "sharepoint"
  | "clickup"
  | "teams";

export type WorkflowIntegrationMetadata = {
  kind: WorkflowIntegrationKind;
  mode: "mock";
  implementation: "simulated";
  provider: string;
  liveEquivalent: string;
  note: string;
};

export type WorkflowApprovalState =
  | {
      status: "not_required";
    }
  | {
      status: "pending";
      stage: "pre-provisioning";
      reason: string;
    }
  | {
      status: "approved";
      stage: "pre-provisioning";
      reason: string;
      approvedBy: string;
      approvedAt: string;
      notes?: string;
    };

export type WorkflowExecutionStep = {
  id: string;
  title: string;
  status: WorkflowSystemStatus;
  description: string;
  durationMs: number;
  attempts: number;
  retryable: boolean;
  approvalRequired: boolean;
  continuedAfterFailure: boolean;
  errorMessage?: string;
};

export type EmailRecipient = {
  name: string;
  address: string;
  role: string;
};

export type OutlookMessagePayload = {
  subject: string;
  body: {
    contentType: "Text";
    content: string;
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  ccRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  importance: "normal";
};

export type EmailNotificationResult = {
  status: WorkflowSystemStatus;
  integration: WorkflowIntegrationMetadata;
  provider: string;
  recipients: EmailRecipient[];
  subject: string;
  bodyPreview: string;
  payload: {
    message: OutlookMessagePayload;
    saveToSentItems: boolean;
  };
  message: string;
};

export type SharepointResult = {
  status: WorkflowSystemStatus;
  integration: WorkflowIntegrationMetadata;
  action: string;
  sourceFolder: string;
  destinationFolder: string;
  message: string;
};

export type ClickupCustomField = {
  name: string;
  value: string;
};

export type ClickupTaskPayload = {
  title: string;
  description: string;
  owner: string;
  priority: "low" | "medium" | "high";
  startDate: string;
  dueDate: string;
  tags: string[];
};

export type ClickupResult = {
  status: WorkflowSystemStatus;
  integration: WorkflowIntegrationMetadata;
  projectName: string;
  space: string;
  folder: string;
  owner: string;
  startDate: string;
  value: string;
  tags: string[];
  customFields: ClickupCustomField[];
  tasks: ClickupTaskPayload[];
  payload: {
    name: string;
    space: string;
    folder: string;
    owner: string;
    startDate: string;
    tags: string[];
    customFields: ClickupCustomField[];
    tasks: ClickupTaskPayload[];
  };
  message: string;
};

export type TeamsResult = {
  status: WorkflowSystemStatus;
  integration: WorkflowIntegrationMetadata;
  teamName: string;
  channelName: string;
  visibility: "private";
  members: EmailRecipient[];
  owners: EmailRecipient[];
  welcomeMessage: string;
  payload: {
    displayName: string;
    description: string;
    visibility: "private";
    owners: Array<{
      userPrincipalName: string;
      displayName: string;
    }>;
    members: Array<{
      userPrincipalName: string;
      displayName: string;
      role: string;
    }>;
    channels: Array<{
      displayName: string;
      membershipType: "standard";
      welcomeMessage: string;
    }>;
  };
  message: string;
};

export type WorkflowResponse = {
  deal: Deal;
  enrichment: AIOutput;
  enrichmentContext: WorkflowAIExecutionContext;
  approval: WorkflowApprovalState;
  execution: {
    status: WorkflowExecutionSummaryStatus;
    totalDurationMs: number;
    steps: WorkflowExecutionStep[];
  };
  systems: {
    email: EmailNotificationResult;
    sharepoint: SharepointResult;
    clickup: ClickupResult;
    teams: TeamsResult;
  };
};
