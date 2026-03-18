import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAIOutputFixture,
  createDealFixture,
  createWorkflowResponseFixture,
  createWorkflowRunRecordFixture,
  createWorkflowRunResponseFixture,
} from "@/test/fixtures";

const { getWorkflowRunMock, processDealMock, updateWorkflowRunMock } = vi.hoisted(() => ({
  getWorkflowRunMock: vi.fn(),
  processDealMock: vi.fn(),
  updateWorkflowRunMock: vi.fn(),
}));

vi.mock("@/lib/workflow/process-deal", () => ({
  processDeal: processDealMock,
}));

vi.mock("@/lib/workflow/workflow-run-store", () => ({
  getWorkflowRun: getWorkflowRunMock,
  updateWorkflowRun: updateWorkflowRunMock,
  toWorkflowRunResponse: (record: ReturnType<typeof createWorkflowRunRecordFixture>) => ({
    workflowRunId: record.workflowRunId,
    ...record.response,
  }),
}));

describe("POST /api/workflow/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkflowRunMock.mockResolvedValue(
      createWorkflowRunRecordFixture({
        response: createWorkflowResponseFixture({
          approval: {
            status: "pending",
            stage: "pre-provisioning",
            reason: "AI enrichment fell back to deterministic output",
          },
          enrichmentContext: {
            mode: "fallback",
            attempts: 2,
            failureReason: "json_parse_failed",
          },
        }),
      })
    );
    updateWorkflowRunMock.mockResolvedValue(
      createWorkflowRunRecordFixture({
        response: createWorkflowResponseFixture({
          approval: {
            status: "approved",
            stage: "pre-provisioning",
            reason: "AI enrichment fell back to deterministic output",
            approvedBy: "Operations Lead",
            approvedAt: "2026-03-17T00:05:00.000Z",
            notes: "Reviewed and approved.",
          },
        }),
      })
    );
  });

  it("resumes the workflow using the stored enrichment and approval decision", async () => {
    vi.resetModules();
    processDealMock.mockResolvedValue(createWorkflowResponseFixture());
    const { POST } = await import("@/app/api/workflow/resume/route");

    const response = await POST(
      new Request("http://localhost/api/workflow/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowRunId: "run-001",
          approval: {
            approvedBy: "Operations Lead",
            notes: "Reviewed and approved.",
          },
        }),
      })
    );
    const payload = (await response.json()) as ReturnType<
      typeof createWorkflowRunResponseFixture
    >;

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    expect(getWorkflowRunMock).toHaveBeenCalledWith("run-001");
    expect(processDealMock).toHaveBeenCalledWith(createDealFixture(), {
      enrichmentContext: {
        mode: "fallback",
        attempts: 2,
        failureReason: "json_parse_failed",
      },
      enrichmentOverride: createAIOutputFixture(),
      approvalDecision: {
        approvedBy: "Operations Lead",
        notes: "Reviewed and approved.",
      },
      observability: expect.objectContaining({
        route: "/api/workflow/resume",
        workflowRunId: "run-001",
      }),
    });
    expect(updateWorkflowRunMock).toHaveBeenCalledWith(
      "run-001",
      expect.any(Object)
    );
    expect(payload.workflowRunId).toBe("run-001");
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
          workflowRunId: "",
          approval: {},
        }),
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid workflow resume payload.");
    expect(processDealMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the workflow run does not exist", async () => {
    vi.resetModules();
    getWorkflowRunMock.mockResolvedValue(null);
    const { POST } = await import("@/app/api/workflow/resume/route");

    const response = await POST(
      new Request("http://localhost/api/workflow/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowRunId: "missing-run",
          approval: {
            approvedBy: "Operations Lead",
          },
        }),
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Workflow run was not found.");
    expect(processDealMock).not.toHaveBeenCalled();
  });
});
