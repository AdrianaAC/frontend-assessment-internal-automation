import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAIOutputFixture, createDealFixture } from "@/test/fixtures";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("@/lib/ai/openai", () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  }),
}));

describe("runAIEnrichment", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;

  beforeEach(() => {
    createMock.mockReset();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_MODEL = originalModel;
  });

  it("uses deterministic fallback when credentials are missing", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;

    const { runAIEnrichment } = await import("@/lib/ai/prompts");
    const result = await runAIEnrichment(createDealFixture());

    expect(result.mode).toBe("fallback");
    expect(result.attempts).toBe(0);
    expect(result.failureReason).toBe("missing_credentials");
    expect(result.output.kickoffEmail.subject).toContain("Kickoff | Acme Industries");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns live enrichment when the AI response matches the schema", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(createAIOutputFixture()),
          },
        },
      ],
    });

    const { runAIEnrichment } = await import("@/lib/ai/prompts");
    const result = await runAIEnrichment(createDealFixture());

    expect(result.mode).toBe("live");
    expect(result.attempts).toBe(1);
    expect(result.output.projectClassification.projectType).toBe("implementation");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("retries parse failures and falls back after exhausting attempts", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: "{not-valid-json",
          },
        },
      ],
    });

    const { runAIEnrichment } = await import("@/lib/ai/prompts");
    const result = await runAIEnrichment(createDealFixture());

    expect(result.mode).toBe("fallback");
    expect(result.attempts).toBe(2);
    expect(result.failureReason).toBe("json_parse_failed");
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
