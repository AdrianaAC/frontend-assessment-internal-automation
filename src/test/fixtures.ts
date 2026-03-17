import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";
import type { WorkflowResponse } from "@/types/workflow";

export function createDealFixture(overrides: Partial<Deal> = {}): Deal {
  return {
    dealId: "DEAL-001",
    dealName: "Digital Transformation Kickoff",
    clientName: "Acme Industries",
    value: 25000,
    currency: "EUR",
    ownerName: "Sales Owner",
    ownerEmail: "sales@company.com",
    financeName: "Finance Partner",
    financeEmail: "finance@company.com",
    projectManagerName: "Project Manager",
    projectManagerEmail: "pm@company.com",
    sponsorName: "Executive Sponsor",
    sponsorEmail: "sponsor@company.com",
    consultantName: "Consultant",
    consultantEmail: "consultant@company.com",
    juniorConsultantName: "Junior Consultant",
    juniorConsultantEmail: "junior@company.com",
    serviceType: "implementation",
    startDate: "2026-03-20",
    notes: "Client wants a fast kickoff and weekly reporting.",
    ...overrides,
  };
}

export function createAIOutputFixture(overrides: Partial<AIOutput> = {}): AIOutput {
  return {
    projectClassification: {
      projectType: "implementation",
      complexity: "medium",
      riskLevel: "medium",
      recommendedTemplate: "Implementation Kickoff Template",
    },
    kickoffEmail: {
      subject: "Kickoff | Acme Industries | Digital Transformation Kickoff",
      body: "Hello team,\n\nProject kickoff details.",
    },
    teamsIntroMessage: "Welcome everyone - kickoff is starting.",
    clickupTasks: [
      {
        title: "Create kickoff meeting",
        description: "Schedule the kickoff.",
        owner: "Project Manager",
        priority: "high",
      },
    ],
    ...overrides,
  };
}

export function createWorkflowResponseFixture(
  overrides: Partial<WorkflowResponse> = {}
): WorkflowResponse {
  const deal = createDealFixture();
  const enrichment = createAIOutputFixture();

  return {
    deal,
    enrichment,
    enrichmentContext: {
      mode: "live",
      attempts: 1,
    },
    approval: {
      status: "not_required",
    },
    execution: {
      status: "success",
      totalDurationMs: 25,
      steps: [
        {
          id: "deal-received",
          title: "Deal Received",
          status: "success",
          description: "Deal received.",
          durationMs: 0,
          attempts: 1,
          retryable: false,
          approvalRequired: false,
          continuedAfterFailure: false,
        },
      ],
    },
    systems: {
      email: {
        status: "success",
        integration: {
          kind: "email",
          mode: "mock",
          implementation: "simulated",
          provider: "Office365 / Outlook",
          liveEquivalent: "Microsoft Graph sendMail",
          note: "Simulated payload only. No live email was sent.",
        },
        provider: "Office365 / Outlook",
        recipients: [
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
        ],
        subject: enrichment.kickoffEmail.subject,
        bodyPreview: enrichment.kickoffEmail.body,
        payload: {
          message: {
            subject: enrichment.kickoffEmail.subject,
            body: {
              contentType: "Text",
              content: enrichment.kickoffEmail.body,
            },
            toRecipients: [],
            ccRecipients: [],
            importance: "normal",
          },
          saveToSentItems: true,
        },
        message: "Email prepared.",
      },
      sharepoint: {
        status: "success",
        integration: {
          kind: "sharepoint",
          mode: "mock",
          implementation: "simulated",
          provider: "SharePoint Online",
          liveEquivalent: "Microsoft Graph / SharePoint REST",
          note: "Simulated folder move only. No live document operation was executed.",
        },
        action: "move",
        sourceFolder: "/Propostas em Curso/Acme Industries",
        destinationFolder: "/Projetos Ativos/Acme Industries",
        message: "SharePoint moved.",
      },
      clickup: {
        status: "success",
        integration: {
          kind: "clickup",
          mode: "mock",
          implementation: "simulated",
          provider: "ClickUp",
          liveEquivalent: "ClickUp API",
          note: "Simulated project provisioning only. No live ClickUp resources were created.",
        },
        projectName: "Acme Industries - Digital Transformation Kickoff",
        space: "Operations",
        folder: "Active Projects",
        owner: deal.projectManagerName,
        startDate: deal.startDate ?? "TBD",
        value: `${deal.value} ${deal.currency}`,
        tags: ["implementation"],
        customFields: [],
        tasks: [],
        payload: {
          name: "Acme Industries - Digital Transformation Kickoff",
          space: "Operations",
          folder: "Active Projects",
          owner: deal.projectManagerName,
          startDate: deal.startDate ?? "TBD",
          tags: ["implementation"],
          customFields: [],
          tasks: [],
        },
        message: "ClickUp created.",
      },
      teams: {
        status: "success",
        integration: {
          kind: "teams",
          mode: "mock",
          implementation: "simulated",
          provider: "Microsoft Teams",
          liveEquivalent: "Microsoft Graph groups / teams / channels",
          note: "Simulated team provisioning only. No live Teams workspace was created.",
        },
        teamName: "Acme Industries Delivery Team",
        channelName: "acme-industries-kickoff",
        visibility: "private",
        members: [],
        owners: [],
        welcomeMessage: enrichment.teamsIntroMessage,
        payload: {
          displayName: "Acme Industries Delivery Team",
          description: "Project workspace for Acme.",
          visibility: "private",
          owners: [],
          members: [],
          channels: [],
        },
        message: "Teams provisioned.",
      },
    },
    ...overrides,
  };
}
