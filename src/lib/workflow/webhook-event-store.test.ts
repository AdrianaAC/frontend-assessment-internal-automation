import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("webhook-event-store", () => {
  let tempDir: string;
  let storeFilePath: string;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "webhook-event-store-"));
    storeFilePath = path.join(tempDir, "webhook-events.json");
    process.env.WEBHOOK_EVENT_STORE_FILE = storeFilePath;
    delete process.env.WEBHOOK_EVENT_PROCESSING_TTL_MS;
  });

  afterEach(async () => {
    delete process.env.WEBHOOK_EVENT_STORE_FILE;
    delete process.env.WEBHOOK_EVENT_PROCESSING_TTL_MS;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists processed webhook events and rejects duplicates", async () => {
    const {
      markWebhookEventProcessed,
      startWebhookEventProcessing,
    } = await import("@/lib/workflow/webhook-event-store");

    const firstClaim = await startWebhookEventProcessing({
      eventId: "evt-001",
      occurredAt: "2026-03-16T10:00:00.000Z",
      source: "pipedrive-webhook",
    });

    expect(firstClaim).toMatchObject({
      ok: true,
      reclaimedStaleLock: false,
    });

    await markWebhookEventProcessed({
      eventId: "evt-001",
      workflowRunId: "run-001",
    });

    const secondClaim = await startWebhookEventProcessing({
      eventId: "evt-001",
      occurredAt: "2026-03-16T10:00:00.000Z",
      source: "pipedrive-webhook",
    });

    expect(secondClaim).toMatchObject({
      ok: false,
      reason: "processed",
      record: {
        workflowRunId: "run-001",
      },
    });
  });

  it("reclaims stale processing records", async () => {
    process.env.WEBHOOK_EVENT_PROCESSING_TTL_MS = "1";
    const staleUpdatedAt = "2026-03-16T10:00:00.000Z";
    await writeFile(
      storeFilePath,
      JSON.stringify(
        {
          events: {
            "evt-001": {
              eventId: "evt-001",
              status: "processing",
              source: "pipedrive-webhook",
              occurredAt: "2026-03-16T10:00:00.000Z",
              createdAt: staleUpdatedAt,
              updatedAt: staleUpdatedAt,
            },
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const { startWebhookEventProcessing } = await import(
      "@/lib/workflow/webhook-event-store"
    );

    const claim = await startWebhookEventProcessing({
      eventId: "evt-001",
      occurredAt: "2026-03-16T10:00:00.000Z",
      source: "pipedrive-webhook",
    });

    expect(claim).toMatchObject({
      ok: true,
      reclaimedStaleLock: true,
    });

    const stored = JSON.parse(await readFile(storeFilePath, "utf8")) as {
      events: Record<string, { status: string }>;
    };

    expect(stored.events["evt-001"].status).toBe("processing");
  });
});
