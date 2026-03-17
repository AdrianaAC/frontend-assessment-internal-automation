import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAIOutputFixture, createDealFixture } from "@/test/fixtures";

const { runAIEnrichmentMock, mockEmailNotificationMock, mockSharepointMoveMock, mockClickupProjectMock, mockTeamsChannelMock } =
  vi.hoisted(() => ({
    runAIEnrichmentMock: vi.fn(),
    mockEmailNotificationMock: vi.fn(),
    mockSharepointMoveMock: vi.fn(),
    mockClickupProjectMock: vi.fn(),
    mockTeamsChannelMock: vi.fn(),
  }));

vi.mock("@/lib/ai/prompts", () => ({
  runAIEnrichment: runAIEnrichmentMock,
}));

vi.mock("@/lib/workflow/mocks", () => ({
  mockEmailNotification: mockEmailNotificationMock,
  mockSharepointMove: mockSharepointMoveMock,
  mockClickupProject: mockClickupProjectMock,
  mockTeamsChannel: mockTeamsChannelMock,
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
    mockEmailNotificationMock.mockResolvedValue({
      status: "success",
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
    mockSharepointMoveMock.mockRejectedValue(new Error("SharePoint unavailable"));
    mockClickupProjectMock.mockResolvedValue({
      status: "success",
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
    mockTeamsChannelMock.mockResolvedValue({
      status: "success",
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
    mockEmailNotificationMock.mockResolvedValue({
      status: "success",
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
    mockSharepointMoveMock.mockResolvedValue({
      status: "success",
      action: "move",
      sourceFolder: "from",
      destinationFolder: "to",
      message: "SharePoint moved.",
    });
    mockClickupProjectMock.mockResolvedValue({
      status: "success",
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
    mockTeamsChannelMock.mockResolvedValue({
      status: "success",
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

    expect(result.execution.status).toBe("warning");
    expect(
      result.execution.steps.find((step) => step.id === "ai-enrichment")
    ).toMatchObject({
      status: "warning",
      approvalRequired: true,
      attempts: 2,
      errorMessage: "json_parse_failed",
    });
  });
});
