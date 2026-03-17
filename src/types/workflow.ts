import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";

export type WorkflowSystemStatus = "success" | "error" | "warning" | "pending";

export type WorkflowExecutionSummaryStatus = "success" | "warning" | "error";

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
