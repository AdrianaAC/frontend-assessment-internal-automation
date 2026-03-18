import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAIOutputFixture, createDealFixture } from "@/test/fixtures";

const { runAIEnrichmentMock, prepareEmailNotificationMock, moveSharepointFolderMock, createClickupProjectMock, provisionTeamsWorkspaceMock } =
  vi.hoisted(() => ({
    runAIEnrichmentMock: vi.fn(),
    prepareEmailNotificationMock: vi.fn(),
    moveSharepointFolderMock: vi.fn(),
    createClickupProjectMock: vi.fn(),
    provisionTeamsWorkspaceMock: vi.fn(),
  }));

vi.mock("@/lib/ai/prompts", () => ({
  runAIEnrichment: runAIEnrichmentMock,
}));

vi.mock("@/lib/workflow/integrations", () => ({
  prepareEmailNotification: prepareEmailNotificationMock,
  moveSharepointFolder: moveSharepointFolderMock,
  createClickupProject: createClickupProjectMock,
  provisionTeamsWorkspace: provisionTeamsWorkspaceMock,
  getIntegrationMetadata: (kind: string) => ({
    kind,
    mode: "mock",
    implementation: "simulated",
    provider: kind,
    liveEquivalent: `${kind}-live`,
    note: `${kind}-note`,
  }),
}));

describe("processDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues running downstream steps after one integration fails", async () => {
    const deal = createDealFixture();
    const enrichment = createAIOutputFixture();

    runAIEnrichmentMock.mockResolvedValue({
      output: enrichment,
      mode: "live",
      attempts: 1,
    });
    prepareEmailNotificationMock.mockResolvedValue({
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
      recipients: [],
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
    });
    moveSharepointFolderMock.mockRejectedValue(new Error("SharePoint unavailable"));
    createClickupProjectMock.mockResolvedValue({
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
    });
    provisionTeamsWorkspaceMock.mockResolvedValue({
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
        description: "Project workspace",
        visibility: "private",
        owners: [],
        members: [],
        channels: [],
      },
      message: "Teams provisioned.",
    });

    const { processDeal } = await import("@/lib/workflow/process-deal");
    const result = await processDeal(deal);

    expect(result.execution.status).toBe("error");
    expect(result.execution.steps).toHaveLength(6);
    expect(result.systems.sharepoint.status).toBe("error");
    expect(result.systems.clickup.status).toBe("success");
    expect(result.systems.teams.status).toBe("success");
    expect(
      result.execution.steps.find((step) => step.id === "sharepoint-setup")
    ).toMatchObject({
      status: "error",
      retryable: true,
      approvalRequired: true,
      continuedAfterFailure: true,
      attempts: 2,
    });
  });

  it("marks the AI step as warning when fallback enrichment is used", async () => {
    runAIEnrichmentMock.mockResolvedValue({
      output: createAIOutputFixture(),
      mode: "fallback",
      attempts: 2,
      failureReason: "json_parse_failed",
    });
    prepareEmailNotificationMock.mockResolvedValue({
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
      recipients: [],
      subject: "subject",
      bodyPreview: "body",
      payload: {
        message: {
          subject: "subject",
          body: {
            contentType: "Text",
            content: "body",
          },
          toRecipients: [],
          ccRecipients: [],
          importance: "normal",
        },
        saveToSentItems: true,
      },
      message: "Email prepared.",
    });
    moveSharepointFolderMock.mockResolvedValue({
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
      sourceFolder: "from",
      destinationFolder: "to",
      message: "SharePoint moved.",
    });
    createClickupProjectMock.mockResolvedValue({
      status: "success",
      integration: {
        kind: "clickup",
        mode: "mock",
        implementation: "simulated",
        provider: "ClickUp",
        liveEquivalent: "ClickUp API",
        note: "Simulated project provisioning only. No live ClickUp resources were created.",
      },
      projectName: "name",
      space: "space",
      folder: "folder",
      owner: "owner",
      startDate: "2026-03-20",
      value: "25000 EUR",
      tags: [],
      customFields: [],
      tasks: [],
      payload: {
        name: "name",
        space: "space",
        folder: "folder",
        owner: "owner",
        startDate: "2026-03-20",
        tags: [],
        customFields: [],
        tasks: [],
      },
      message: "ClickUp created.",
    });
    provisionTeamsWorkspaceMock.mockResolvedValue({
      status: "success",
      integration: {
        kind: "teams",
        mode: "mock",
        implementation: "simulated",
        provider: "Microsoft Teams",
        liveEquivalent: "Microsoft Graph groups / teams / channels",
        note: "Simulated team provisioning only. No live Teams workspace was created.",
      },
      teamName: "team",
      channelName: "channel",
      visibility: "private",
      members: [],
      owners: [],
      welcomeMessage: "hello",
      payload: {
        displayName: "team",
        description: "desc",
        visibility: "private",
        owners: [],
        members: [],
        channels: [],
      },
      message: "Teams provisioned.",
    });

    const { processDeal } = await import("@/lib/workflow/process-deal");
    const result = await processDeal(createDealFixture());

    expect(result.execution.status).toBe("pending");
    expect(result.approval).toMatchObject({
      status: "pending",
      stage: "pre-provisioning",
    });
    expect(
      result.execution.steps.find((step) => step.id === "ai-enrichment")
    ).toMatchObject({
      status: "warning",
      approvalRequired: true,
      attempts: 2,
      errorMessage: "json_parse_failed",
    });
    expect(
      result.execution.steps.find((step) => step.id === "human-approval")
    ).toMatchObject({
      status: "pending",
      approvalRequired: true,
    });
    expect(prepareEmailNotificationMock).not.toHaveBeenCalled();
  });

  it("resumes a paused workflow after approval and keeps the original enrichment context", async () => {
    const deal = createDealFixture();
    const enrichment = createAIOutputFixture({
      projectClassification: {
        projectType: "implementation",
        complexity: "high",
        riskLevel: "high",
        recommendedTemplate: "High Risk Template",
      },
    });

    runAIEnrichmentMock.mockResolvedValue({
      output: enrichment,
      mode: "live",
      attempts: 1,
    });
    prepareEmailNotificationMock.mockResolvedValue({
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
      recipients: [],
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
    });
    moveSharepointFolderMock.mockResolvedValue({
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
      sourceFolder: "from",
      destinationFolder: "to",
      message: "SharePoint moved.",
    });
    createClickupProjectMock.mockResolvedValue({
      status: "success",
      integration: {
        kind: "clickup",
        mode: "mock",
        implementation: "simulated",
        provider: "ClickUp",
        liveEquivalent: "ClickUp API",
        note: "Simulated project provisioning only. No live ClickUp resources were created.",
      },
      projectName: "name",
      space: "space",
      folder: "folder",
      owner: "owner",
      startDate: "2026-03-20",
      value: "25000 EUR",
      tags: [],
      customFields: [],
      tasks: [],
      payload: {
        name: "name",
        space: "space",
        folder: "folder",
        owner: "owner",
        startDate: "2026-03-20",
        tags: [],
        customFields: [],
        tasks: [],
      },
      message: "ClickUp created.",
    });
    provisionTeamsWorkspaceMock.mockResolvedValue({
      status: "success",
      integration: {
        kind: "teams",
        mode: "mock",
        implementation: "simulated",
        provider: "Microsoft Teams",
        liveEquivalent: "Microsoft Graph groups / teams / channels",
        note: "Simulated team provisioning only. No live Teams workspace was created.",
      },
      teamName: "team",
      channelName: "channel",
      visibility: "private",
      members: [],
      owners: [],
      welcomeMessage: "hello",
      payload: {
        displayName: "team",
        description: "desc",
        visibility: "private",
        owners: [],
        members: [],
        channels: [],
      },
      message: "Teams provisioned.",
    });

    const { processDeal } = await import("@/lib/workflow/process-deal");
    const result = await processDeal(deal, {
      enrichmentOverride: enrichment,
      enrichmentContext: {
        mode: "live",
        attempts: 1,
      },
      approvalDecision: {
        approvedBy: "Operations Lead",
        notes: "Reviewed.",
      },
    });

    expect(result.execution.status).toBe("success");
    expect(result.approval).toMatchObject({
      status: "approved",
      approvedBy: "Operations Lead",
      notes: "Reviewed.",
    });
    expect(
      result.execution.steps.find((step) => step.id === "human-approval")
    ).toMatchObject({
      status: "success",
      approvalRequired: false,
    });
    expect(prepareEmailNotificationMock).toHaveBeenCalledTimes(1);
    expect(runAIEnrichmentMock).not.toHaveBeenCalled();
  });

  it("normalizes duplicate recipient emails and sanitizes resource names in pending outputs", async () => {
    runAIEnrichmentMock.mockResolvedValue({
      output: createAIOutputFixture({
        projectClassification: {
          projectType: "implementation",
          complexity: "medium",
          riskLevel: "high",
          recommendedTemplate: "Standard Template",
        },
      }),
      mode: "live",
      attempts: 1,
    });

    const { processDeal } = await import("@/lib/workflow/process-deal");
    const result = await processDeal(
      createDealFixture({
        clientName: ' Ação / Client:*?  ',
        ownerEmail: "TEAM@company.com",
        projectManagerEmail: "team@company.com",
      })
    );

    expect(result.execution.status).toBe("pending");
    expect(result.systems.email.recipients).toHaveLength(5);
    expect(result.systems.sharepoint.sourceFolder).toBe(
      "/Propostas em Curso/Ação Client"
    );
    expect(result.systems.sharepoint.destinationFolder).toBe(
      "/Projetos Ativos/Ação Client"
    );
    expect(result.systems.teams.channelName).toBe("acao-client-kickoff");
    expect(result.systems.teams.teamName).toBe("Ação / Client:*? Delivery Team");
  });
  it("deduplicates ClickUp tags when complexity and risk level match", async () => {
    runAIEnrichmentMock.mockResolvedValue({
      output: createAIOutputFixture({
        projectClassification: {
          projectType: "implementation",
          complexity: "medium",
          riskLevel: "medium",
          recommendedTemplate: "Standard Template",
        },
      }),
      mode: "fallback",
      attempts: 2,
      failureReason: "json_parse_failed",
    });

    const { processDeal } = await import("@/lib/workflow/process-deal");
    const result = await processDeal(createDealFixture());

    expect(result.execution.status).toBe("pending");
    expect(result.systems.clickup.tags).toEqual(["implementation", "medium"]);
    expect(result.systems.clickup.payload.tags).toEqual(["implementation", "medium"]);
  });
});
