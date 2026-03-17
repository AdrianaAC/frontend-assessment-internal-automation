import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAIOutputFixture,
  createDealFixture,
  createWorkflowResponseFixture,
} from "@/test/fixtures";

const { processDealMock } = vi.hoisted(() => ({
  processDealMock: vi.fn(),
}));

vi.mock("@/lib/workflow/process-deal", () => ({
  processDeal: processDealMock,
}));

describe("POST /api/workflow/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resumes the workflow using the stored enrichment and approval decision", async () => {
    vi.resetModules();
    processDealMock.mockResolvedValue(createWorkflowResponseFixture());
    const { POST } = await import("@/app/api/workflow/resume/route");
    const deal = createDealFixture();
    const enrichment = createAIOutputFixture();

    const response = await POST(
      new Request("http://localhost/api/workflow/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deal,
          enrichment,
          enrichmentContext: {
            mode: "fallback",
            attempts: 2,
            failureReason: "json_parse_failed",
          },
          approval: {
            approvedBy: "Operations Lead",
            notes: "Reviewed and approved.",
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(processDealMock).toHaveBeenCalledWith(deal, {
      enrichmentContext: {
        mode: "fallback",
        attempts: 2,
        failureReason: "json_parse_failed",
      },
      enrichmentOverride: enrichment,
      approvalDecision: {
        approvedBy: "Operations Lead",
        notes: "Reviewed and approved.",
      },
    });
  });

  it("returns 400 for an invalid resume payload", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/workflow/resume/route");

    const response = await POST(
      new Request("http://localhost/api/workflow/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deal: {
            dealId: "",
          },
          approval: {},
        }),
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid workflow resume payload.");
    expect(processDealMock).not.toHaveBeenCalled();
  });
});
