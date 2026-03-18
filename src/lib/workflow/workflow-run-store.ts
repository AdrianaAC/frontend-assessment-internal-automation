import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  WorkflowResponse,
  WorkflowRunRecord,
  WorkflowRunResponse,
} from "@/types/workflow";

type WorkflowRunStoreData = {
  runs: Record<string, WorkflowRunRecord>;
};

const DEFAULT_STORE_FILE = path.join(
  process.cwd(),
  ".data",
  "workflow-runs.json"
);

let storeLock = Promise.resolve();

// Chooses the file used to persist workflow runs between requests.
function getStoreFilePath() {
  return process.env.WORKFLOW_RUN_STORE_FILE || DEFAULT_STORE_FILE;
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

// Makes sure the storage folder exists before writing workflow data.
async function ensureStoreDirectory(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

// Loads all saved workflow runs from disk.
async function readStoreData(): Promise<WorkflowRunStoreData> {
  const filePath = getStoreFilePath();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkflowRunStoreData>;

    return {
      runs: parsed.runs ?? {},
    };
  } catch (error) {
    if (isENOENT(error)) {
      return {
        runs: {},
      };
    }

    throw error;
  }
}

// Writes the latest workflow-run snapshot to disk safely.
async function writeStoreData(data: WorkflowRunStoreData) {
  const filePath = getStoreFilePath();
  const tempFilePath = `${filePath}.tmp`;

  await ensureStoreDirectory(filePath);
  await writeFile(tempFilePath, JSON.stringify(data, null, 2), "utf8");
  await rename(tempFilePath, filePath);
}

// Serializes file access so concurrent requests do not corrupt the store.
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

// Converts the internal stored record into the API shape returned to the UI.
export function toWorkflowRunResponse(
  record: WorkflowRunRecord
): WorkflowRunResponse {
  return {
    workflowRunId: record.workflowRunId,
    ...record.response,
  };
}

// Creates and saves a brand-new workflow run after initial processing.
export async function createWorkflowRun(input: {
  response: WorkflowResponse;
  sourceEventId?: string;
}): Promise<WorkflowRunRecord> {
  return withStoreLock(async () => {
    const store = await readStoreData();
    const now = new Date().toISOString();
    const record: WorkflowRunRecord = {
      workflowRunId: randomUUID(),
      sourceEventId: input.sourceEventId,
      createdAt: now,
      updatedAt: now,
      response: input.response,
    };

    store.runs[record.workflowRunId] = record;
    await writeStoreData(store);

    return record;
  });
}

// Retrieves a saved workflow run by its unique identifier.
export async function getWorkflowRun(
  workflowRunId: string
): Promise<WorkflowRunRecord | null> {
  const store = await readStoreData();

  return store.runs[workflowRunId] ?? null;
}

// Replaces the stored workflow response after the run is resumed or updated.
export async function updateWorkflowRun(
  workflowRunId: string,
  response: WorkflowResponse
): Promise<WorkflowRunRecord | null> {
  return withStoreLock(async () => {
    const store = await readStoreData();
    const existingRecord = store.runs[workflowRunId];

    if (!existingRecord) {
      return null;
    }

    const updatedRecord: WorkflowRunRecord = {
      ...existingRecord,
      updatedAt: new Date().toISOString(),
      response,
    };

    store.runs[workflowRunId] = updatedRecord;
    await writeStoreData(store);

    return updatedRecord;
  });
}
