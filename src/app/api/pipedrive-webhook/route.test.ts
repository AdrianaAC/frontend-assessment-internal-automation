import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDealFixture,
  createWebhookEventRecordFixture,
  createWorkflowResponseFixture,
  createWorkflowRunRecordFixture,
} from "@/test/fixtures";
import type { PipedriveDealWebhookPayload } from "@/types/pipedrive";

const {
  createWorkflowRunMock,
  markWebhookEventProcessedMock,
  processDealMock,
  releaseWebhookEventProcessingMock,
  startWebhookEventProcessingMock,
} = vi.hoisted(() => ({
  createWorkflowRunMock: vi.fn(),
  markWebhookEventProcessedMock: vi.fn(),
  processDealMock: vi.fn(),
  releaseWebhookEventProcessingMock: vi.fn(),
  startWebhookEventProcessingMock: vi.fn(),
}));

vi.mock("@/lib/workflow/process-deal", () => ({
  processDeal: processDealMock,
}));

vi.mock("@/lib/workflow/workflow-run-store", () => ({
  createWorkflowRun: createWorkflowRunMock,
  toWorkflowRunResponse: (record: ReturnType<typeof createWorkflowRunRecordFixture>) => ({
    workflowRunId: record.workflowRunId,
    ...record.response,
  }),
}));

vi.mock("@/lib/workflow/webhook-event-store", () => ({
  startWebhookEventProcessing: startWebhookEventProcessingMock,
  markWebhookEventProcessed: markWebhookEventProcessedMock,
  releaseWebhookEventProcessing: releaseWebhookEventProcessingMock,
}));

// Builds a valid Pipedrive webhook payload for route tests.
function createWebhookPayload(): PipedriveDealWebhookPayload {
  const deal = createDealFixture();

  return {
    meta: {
      event: "updated.deal",
      eventId: "evt-001",
      occurredAt: "2026-03-16T10:00:00.000Z",
      source: "pipedrive",
    },
    current: {
      dealId: deal.dealId,
      title: deal.dealName,
      clientName: deal.clientName,
      value: deal.value,
      currency: deal.currency,
      status: "won",
      stageName: "Won",
      ownerName: deal.ownerName,
      ownerEmail: deal.ownerEmail,
      financeName: deal.financeName,
      financeEmail: deal.financeEmail,
      projectManagerName: deal.projectManagerName,
      projectManagerEmail: deal.projectManagerEmail,
      sponsorName: deal.sponsorName,
      sponsorEmail: deal.sponsorEmail,
      consultantName: deal.consultantName,
      consultantEmail: deal.consultantEmail,
      juniorConsultantName: deal.juniorConsultantName,
      juniorConsultantEmail: deal.juniorConsultantEmail,
      serviceType: deal.serviceType,
      startDate: deal.startDate,
      notes: deal.notes,
    },
    previous: {
      status: "open",
      stageName: "Proposal Review",
    },
  };
}

describe("POST /api/pipedrive-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createWorkflowRunMock.mockResolvedValue(createWorkflowRunRecordFixture());
    markWebhookEventProcessedMock.mockResolvedValue(
      createWebhookEventRecordFixture({
        status: "processed",
        workflowRunId: "run-001",
      })
    );
    releaseWebhookEventProcessingMock.mockResolvedValue(true);
    startWebhookEventProcessingMock.mockResolvedValue({
      ok: true,
      reclaimedStaleLock: false,
      record: createWebhookEventRecordFixture(),
    });
  });

  it("maps a won webhook into the internal deal model and returns the workflow response", async () => {
    vi.resetModules();
    processDealMock.mockResolvedValue(createWorkflowResponseFixture());
    const { POST } = await import("@/app/api/pipedrive-webhook/route");

    const response = await POST(
      new Request("http://localhost/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createWebhookPayload()),
      })
    );
    const payload = (await response.json()) as { workflowRunId: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    expect(processDealMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: "DEAL-001",
        dealName: "Digital Transformation Kickoff",
        clientName: "Acme Industries",
      }),
      expect.objectContaining({
        observability: expect.objectContaining({
          route: "/api/pipedrive-webhook",
          sourceEventId: "evt-001",
        }),
      })
    );
    expect(createWorkflowRunMock).toHaveBeenCalledWith({
      response: expect.any(Object),
      sourceEventId: "evt-001",
    });
    expect(markWebhookEventProcessedMock).toHaveBeenCalledWith({
      eventId: "evt-001",
      workflowRunId: "run-001",
    });
    expect(payload.workflowRunId).toBe("run-001");
  });

  it("rejects duplicate webhook event ids with a 409 response", async () => {
    vi.resetModules();
    processDealMock.mockResolvedValue(createWorkflowResponseFixture());
    startWebhookEventProcessingMock
      .mockResolvedValueOnce({
        ok: true,
        reclaimedStaleLock: false,
        record: createWebhookEventRecordFixture(),
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: "processed",
        record: createWebhookEventRecordFixture({
          status: "processed",
          workflowRunId: "run-001",
        }),
      });
    const { POST } = await import("@/app/api/pipedrive-webhook/route");
    const payload = createWebhookPayload();

    const first = await POST(
      new Request("http://localhost/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    );
    const second = await POST(
      new Request("http://localhost/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    );
    const duplicatePayload = (await second.json()) as { error: string };

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(duplicatePayload.error).toContain("already processed");
    expect(processDealMock).toHaveBeenCalledTimes(1);
  });

  it("releases the webhook claim when processing fails", async () => {
    vi.resetModules();
    processDealMock.mockRejectedValue(new Error("workflow failed"));
    const { POST } = await import("@/app/api/pipedrive-webhook/route");

    const response = await POST(
      new Request("http://localhost/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createWebhookPayload()),
      })
    );

    expect(response.status).toBe(500);
    expect(releaseWebhookEventProcessingMock).toHaveBeenCalledWith("evt-001");
    expect(markWebhookEventProcessedMock).not.toHaveBeenCalled();
  });

  it("rejects webhook payloads that do not transition into won", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/pipedrive-webhook/route");
    const payload = createWebhookPayload();
    payload.previous.status = "won";

    const response = await POST(
      new Request("http://localhost/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Webhook does not represent a transition into won.");
    expect(processDealMock).not.toHaveBeenCalled();
  });

  it("rejects webhook payloads with invalid occurredAt or startDate values", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/pipedrive-webhook/route");
    const payload = createWebhookPayload();
    payload.meta.occurredAt = "not-a-date";
    payload.current.startDate = "2026-02-30";

    const response = await POST(
      new Request("http://localhost/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    );
    const body = (await response.json()) as {
      error: string;
      fieldErrors?: Record<string, string>;
    };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Webhook occurredAt is invalid.");
    expect(processDealMock).not.toHaveBeenCalled();
  });
});
