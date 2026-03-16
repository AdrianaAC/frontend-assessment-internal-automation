import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";

export type WorkflowSystemStatus = "success" | "error" | "warning" | "pending";

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

export type ClickupResult = {
  status: WorkflowSystemStatus;
  projectName: string;
  space: string;
  folder: string;
  message: string;
};

export type TeamsResult = {
  status: WorkflowSystemStatus;
  teamName: string;
  channelName: string;
  message: string;
};

export type WorkflowResponse = {
  deal: Deal;
  enrichment: AIOutput;
  systems: {
    email: EmailNotificationResult;
    sharepoint: SharepointResult;
    clickup: ClickupResult;
    teams: TeamsResult;
  };
};
