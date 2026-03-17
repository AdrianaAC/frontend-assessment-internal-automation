import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDealFixture, createWorkflowResponseFixture } from "@/test/fixtures";
import type { PipedriveDealWebhookPayload } from "@/types/pipedrive";

const { processDealMock } = vi.hoisted(() => ({
  processDealMock: vi.fn(),
}));

vi.mock("@/lib/workflow/process-deal", () => ({
  processDeal: processDealMock,
}));

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

    expect(response.status).toBe(200);
    expect(processDealMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: "DEAL-001",
        dealName: "Digital Transformation Kickoff",
        clientName: "Acme Industries",
      })
    );
  });

  it("rejects duplicate webhook event ids with a 409 response", async () => {
    vi.resetModules();
    processDealMock.mockResolvedValue(createWorkflowResponseFixture());
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
});
