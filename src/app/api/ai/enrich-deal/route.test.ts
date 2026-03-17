import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAIOutputFixture, createDealFixture } from "@/test/fixtures";

const { enrichDealWithAIMock } = vi.hoisted(() => ({
  enrichDealWithAIMock: vi.fn(),
}));

vi.mock("@/lib/ai/prompts", () => ({
  enrichDealWithAI: enrichDealWithAIMock,
}));

describe("POST /api/ai/enrich-deal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an invalid deal payload", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/ai/enrich-deal/route");
    const request = new Request("http://localhost/api/ai/enrich-deal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealId: "" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string; fieldErrors: Record<string, string> };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid deal payload.");
    expect(payload.fieldErrors.dealName).toBeDefined();
  });

  it("returns enrichment output for a valid deal payload", async () => {
    vi.resetModules();
    enrichDealWithAIMock.mockResolvedValue(createAIOutputFixture());
    const { POST } = await import("@/app/api/ai/enrich-deal/route");
    const request = new Request("http://localhost/api/ai/enrich-deal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createDealFixture()),
    });

    const response = await POST(request);
    const payload = (await response.json()) as ReturnType<typeof createAIOutputFixture>;

    expect(response.status).toBe(200);
    expect(enrichDealWithAIMock).toHaveBeenCalledTimes(1);
    expect(payload.projectClassification.projectType).toBe("implementation");
  });
});
