import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type WebhookEventStatus = "processing" | "processed";

type WebhookEventRecord = {
  eventId: string;
  status: WebhookEventStatus;
  source: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  workflowRunId?: string;
};

type WebhookEventStoreData = {
  events: Record<string, WebhookEventRecord>;
};

type StartWebhookEventResult =
  | {
      ok: true;
      record: WebhookEventRecord;
      reclaimedStaleLock: boolean;
    }
  | {
      ok: false;
      reason: "processing" | "processed";
      record: WebhookEventRecord;
    };

const DEFAULT_STORE_FILE = path.join(
  process.cwd(),
  ".data",
  "webhook-events.json"
);
const DEFAULT_PROCESSING_TTL_MS = 5 * 60 * 1000;

let storeLock = Promise.resolve();
let prefersInMemoryStore = false;
const inMemoryStore: WebhookEventStoreData = {
  events: {},
};

// Chooses the file used to persist webhook idempotency state.
function getStoreFilePath() {
  return process.env.WEBHOOK_EVENT_STORE_FILE || DEFAULT_STORE_FILE;
}

// Reads the configured timeout for reclaiming stuck webhook locks.
function getProcessingTTL() {
  const configuredValue = Number(process.env.WEBHOOK_EVENT_PROCESSING_TTL_MS);

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return configuredValue;
  }

  return DEFAULT_PROCESSING_TTL_MS;
}

// Detects the "file not found" error so the store can be initialized lazily.
function isENOENT(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

// Detects filesystem errors that should trigger the serverless-safe memory fallback.
function isReadonlyFilesystemError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return (
    code === "EROFS" ||
    code === "EPERM" ||
    code === "EACCES" ||
    message.includes("read-only file system")
  );
}

// Identifies a webhook record that has been stuck in processing for too long.
function isStaleProcessingRecord(record: WebhookEventRecord) {
  if (record.status !== "processing") {
    return false;
  }

  const updatedAt = new Date(record.updatedAt).getTime();

  if (Number.isNaN(updatedAt)) {
    return true;
  }

  return Date.now() - updatedAt > getProcessingTTL();
}

// Makes sure the storage folder exists before writing webhook event data.
async function ensureStoreDirectory(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

// Loads all saved webhook events from disk.
async function readStoreData(): Promise<WebhookEventStoreData> {
  if (prefersInMemoryStore) {
    return inMemoryStore;
  }

  const filePath = getStoreFilePath();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WebhookEventStoreData>;

    return {
      events: parsed.events ?? {},
    };
  } catch (error) {
    if (isENOENT(error)) {
      return {
        events: {},
      };
    }

    throw error;
  }
}

// Writes the latest webhook-event snapshot to disk safely.
async function writeStoreData(data: WebhookEventStoreData) {
  if (prefersInMemoryStore) {
    inMemoryStore.events = data.events;
    return;
  }

  const filePath = getStoreFilePath();
  const tempFilePath = `${filePath}.tmp`;

  try {
    await ensureStoreDirectory(filePath);
    await writeFile(tempFilePath, JSON.stringify(data, null, 2), "utf8");
    await rename(tempFilePath, filePath);
  } catch (error) {
    if (!isReadonlyFilesystemError(error)) {
      throw error;
    }

    prefersInMemoryStore = true;
    inMemoryStore.events = data.events;
  }
}

// Serializes file access so concurrent webhook requests do not corrupt the store.
async function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const previousLock = storeLock;
  let releaseLock!: () => void;

  storeLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    return await operation();
  } finally {
    releaseLock();
  }
}

// Claims a webhook event for processing unless it is already active or completed.
export async function startWebhookEventProcessing(input: {
  eventId: string;
  occurredAt: string;
  source: string;
}): Promise<StartWebhookEventResult> {
  return withStoreLock(async () => {
    const store = await readStoreData();
    const existingRecord = store.events[input.eventId];

    if (existingRecord?.status === "processed") {
      return {
        ok: false,
        reason: "processed",
        record: existingRecord,
      };
    }

    if (existingRecord?.status === "processing" && !isStaleProcessingRecord(existingRecord)) {
      return {
        ok: false,
        reason: "processing",
        record: existingRecord,
      };
    }

    const now = new Date().toISOString();
    const record: WebhookEventRecord = {
      eventId: input.eventId,
      status: "processing",
      source: input.source,
      occurredAt: input.occurredAt,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
      workflowRunId: existingRecord?.workflowRunId,
    };

    store.events[input.eventId] = record;
    await writeStoreData(store);

    return {
      ok: true,
      record,
      reclaimedStaleLock: existingRecord?.status === "processing",
    };
  });
}

// Marks a webhook event as fully handled after a workflow run has been saved.
export async function markWebhookEventProcessed(input: {
  eventId: string;
  workflowRunId?: string;
}) {
  return withStoreLock(async () => {
    const store = await readStoreData();
    const existingRecord = store.events[input.eventId];

    if (!existingRecord) {
      return null;
    }

    const updatedRecord: WebhookEventRecord = {
      ...existingRecord,
      status: "processed",
      updatedAt: new Date().toISOString(),
      workflowRunId: input.workflowRunId ?? existingRecord.workflowRunId,
    };

    store.events[input.eventId] = updatedRecord;
    await writeStoreData(store);

    return updatedRecord;
  });
}

// Removes an in-flight webhook claim so the event can be retried after failure.
export async function releaseWebhookEventProcessing(eventId: string) {
  return withStoreLock(async () => {
    const store = await readStoreData();
    const existingRecord = store.events[eventId];

    if (!existingRecord || existingRecord.status !== "processing") {
      return false;
    }

    delete store.events[eventId];
    await writeStoreData(store);

    return true;
  });
}
