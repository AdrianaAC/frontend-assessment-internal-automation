"use client";

import { useId, useState, type ReactNode } from "react";
import ResultCard from "@/components/workflow/ResultCard";
import StatusBadge from "@/components/workflow/StatusBadge";
import WorkflowTimeline from "@/components/workflow/WorkflowTimeline";
import type { WorkflowRunResponse } from "@/types/workflow";

type Props = {
  result: WorkflowRunResponse;
  onApprove?: (approval: { approvedBy: string; notes?: string }) => Promise<void>;
  approving?: boolean;
  approvalError?: string | null;
};

type WorkflowTab = "overview" | "systems" | "content";

type IntegrationMeta = {
  mode: string;
  provider: string;
  liveEquivalent: string;
  note: string;
};

type CopyDownloadActionsProps = {
  label: string;
  filename: string;
  value: unknown;
  onCopy: (label: string, value: unknown) => Promise<void>;
  onDownload: (filename: string, value: unknown) => void;
};

const actionButtonClassName =
  "rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400";

const activeTabClassName =
  "border-zinc-100 bg-zinc-100 text-zinc-950 shadow-[0_10px_30px_rgba(255,255,255,0.08)]";

const inactiveTabClassName =
  "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900";

// Formats step durations into a short label that is easier to read in the UI.
function formatDuration(durationMs: number) {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(2)} s`;
  }

  return `${durationMs} ms`;
}

// Removes duplicate values while preserving the workflow output order.
function dedupeValues(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

// Renders the shared copy and download controls used across the result views.
function CopyDownloadActions({
  label,
  filename,
  value,
  onCopy,
  onDownload,
}: CopyDownloadActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => void onCopy(label, value)}
      >
        Copy JSON
      </button>
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => onDownload(filename, value)}
      >
        Download JSON
      </button>
    </div>
  );
}

// Explains whether each integration is simulated or backed by a live system.
function IntegrationMetaCard({ integration }: { integration: IntegrationMeta }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 text-xs text-zinc-400">
      <p>
        <span className="text-zinc-500">Integration mode:</span>{" "}
        <span className="text-zinc-200">{integration.mode}</span>
      </p>
      <p className="mt-1">
        <span className="text-zinc-500">Provider boundary:</span>{" "}
        <span className="text-zinc-200">{integration.provider}</span>
      </p>
      <p className="mt-1">
        <span className="text-zinc-500">Live target:</span>{" "}
        <span className="text-zinc-200">{integration.liveEquivalent}</span>
      </p>
      <p className="mt-3 leading-5">{integration.note}</p>
    </div>
  );
}

// Displays labeled values in a compact card grid.
function DefinitionList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4"
        >
          <dt className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm text-zinc-200">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Displays a list of people involved in one system payload.
function PeopleList({
  title,
  people,
}: {
  title: string;
  people: Array<{ name: string; address: string; role: string }>;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="mt-3 space-y-2">
        {people.map((person) => (
          <div
            key={`${title}-${person.address}`}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3"
          >
            <p className="text-sm text-zinc-100">{person.name}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {person.role} | {person.address}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hides large raw JSON payloads behind a disclosure to keep the page readable.
function PayloadDisclosure({
  title,
  payload,
  filename,
  onCopy,
  onDownload,
}: {
  title: string;
  payload: unknown;
  filename: string;
  onCopy: (label: string, value: unknown) => Promise<void>;
  onDownload: (filename: string, value: unknown) => void;
}) {
  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-950/80 open:border-zinc-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-200">
        <span>{title}</span>
        <span className="text-xs text-zinc-500 transition group-open:rotate-180">
          v
        </span>
      </summary>
      <div className="space-y-3 border-t border-zinc-800 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            JSON payload
          </p>
          <CopyDownloadActions
            label={title}
            filename={filename}
            value={payload}
            onCopy={onCopy}
            onDownload={onDownload}
          />
        </div>
        <pre className="max-h-96 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-6 text-zinc-400">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </details>
  );
}

// Renders the workflow outcome, approval form, and integration payload details.
export default function WorkflowResult({
  result,
  onApprove,
  approving = false,
  approvalError = null,
}: Props) {
  const [activeTab, setActiveTab] = useState<WorkflowTab>("overview");
  const [approvedBy, setApprovedBy] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [localApprovalError, setLocalApprovalError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const approvalErrorId = useId();
  const actionMessageId = useId();
  const clickupTags = dedupeValues(result.systems.clickup.tags);

  const tabs: Array<{ id: WorkflowTab; label: string; description: string }> = [
    {
      id: "overview",
      label: "Overview",
      description: "Run summary, approval state, and timeline.",
    },
    {
      id: "systems",
      label: "Systems",
      description: "Integration payloads, recipients, and provisioning results.",
    },
    {
      id: "content",
      label: "Content",
      description: "Generated communications and exported workflow artifacts.",
    },
  ];

  const approvalFeedback = localApprovalError ?? approvalError;

  // Validates the approval form and asks the parent page to resume the workflow.
  async function handleApprovalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onApprove) {
      return;
    }

    if (approvedBy.trim().length === 0) {
      setLocalApprovalError("Approver name is required.");
      return;
    }

    setLocalApprovalError(null);
    await onApprove({
      approvedBy: approvedBy.trim(),
      notes: approvalNotes.trim() || undefined,
    });
  }

  // Copies one payload or content block to the user clipboard.
  async function handleCopy(label: string, value: unknown) {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable.");
      }

      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setActionMessage(`${label} copied to clipboard.`);
    } catch {
      setActionMessage(`Failed to copy ${label.toLowerCase()}.`);
    }
  }

  // Downloads one payload or content block as a JSON file.
  function handleDownload(filename: string, value: unknown) {
    const blob = new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setActionMessage(`${filename} downloaded.`);
  }

  return (
    <section className="space-y-6" aria-labelledby="workflow-result-title">
      <h2 id="workflow-result-title" className="sr-only">
        Workflow Result
      </h2>

      <div className="sr-only" role="status" aria-live="polite" id={actionMessageId}>
        {actionMessage ?? ""}
      </div>

      <ResultCard title="Workflow Execution" className="overflow-hidden">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Overall status
                </p>
                <div className="mt-2">
                  <StatusBadge status={result.execution.status} />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Total duration
                </p>
                <p className="mt-2 text-lg font-medium text-zinc-100">
                  {formatDuration(result.execution.totalDurationMs)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Workflow run ID
                </p>
                <p className="mt-2 max-w-64 truncate font-mono text-sm text-zinc-100">
                  {result.workflowRunId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Executed steps
                </p>
                <p className="mt-2 text-lg font-medium text-zinc-100">
                  {result.execution.steps.length}
                </p>
              </div>
            </div>

            <CopyDownloadActions
              label="Workflow run"
              filename={`workflow-run-${result.workflowRunId}.json`}
              value={result}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          </div>

          <div>
            <div
              className="inline-flex flex-wrap gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-2"
              role="tablist"
              aria-label="Workflow result sections"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`workflow-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`workflow-panel-${tab.id}`}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? activeTabClassName : inactiveTabClassName}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              {tabs.find((tab) => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>
      </ResultCard>

      <div
        id="workflow-panel-overview"
        role="tabpanel"
        aria-labelledby="workflow-tab-overview"
        hidden={activeTab !== "overview"}
        className="space-y-6"
      >
        {result.approval.status === "pending" ? (
          <ResultCard title="Human Approval">
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
                <p className="font-medium">Workflow paused before provisioning.</p>
                <p className="mt-2 text-sky-200">{result.approval.reason}.</p>
              </div>

              <form onSubmit={handleApprovalSubmit} className="space-y-4" noValidate>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      className="mb-2 block text-sm text-zinc-400"
                      htmlFor="approvedBy"
                    >
                      Approved by
                    </label>
                    <input
                      id="approvedBy"
                      className={`w-full rounded-lg border bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition ${approvalFeedback ? "border-rose-500/70 focus:border-rose-400" : "border-zinc-700 focus:border-zinc-500"}`}
                      value={approvedBy}
                      onChange={(event) => {
                        setApprovedBy(event.target.value);
                        setLocalApprovalError(null);
                      }}
                      placeholder="Operations lead"
                      disabled={approving}
                      aria-invalid={Boolean(approvalFeedback)}
                      aria-describedby={approvalFeedback ? approvalErrorId : undefined}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm text-zinc-400"
                      htmlFor="approvalNotes"
                    >
                      Approval notes
                    </label>
                    <input
                      id="approvalNotes"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-zinc-500"
                      value={approvalNotes}
                      onChange={(event) => setApprovalNotes(event.target.value)}
                      placeholder="Proceed with planned provisioning"
                      disabled={approving}
                    />
                  </div>
                </div>

                {approvalFeedback ? (
                  <div
                    id={approvalErrorId}
                    className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                    role="alert"
                    aria-live="assertive"
                  >
                    {approvalFeedback}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={approving}
                  className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-100 disabled:opacity-50"
                >
                  {approving ? "Resuming..." : "Approve and continue"}
                </button>
              </form>
            </div>
          </ResultCard>
        ) : null}

        {result.approval.status === "approved" ? (
          <ResultCard title="Human Approval">
            <div className="space-y-3 text-sm text-zinc-300">
              <div className="mb-2">
                <StatusBadge status="success" />
              </div>
              <DefinitionList
                items={[
                  {
                    label: "Approved by",
                    value: result.approval.approvedBy,
                  },
                  {
                    label: "Approved at",
                    value: new Date(result.approval.approvedAt).toLocaleString(),
                  },
                  {
                    label: "Reason",
                    value: result.approval.reason,
                  },
                  {
                    label: "Notes",
                    value: result.approval.notes ?? "No approval notes recorded.",
                  },
                ]}
              />
            </div>
          </ResultCard>
        ) : null}

        <div className="grid gap-6 md:grid-cols-3">
          <ResultCard title="Project Type">
            <p className="text-2xl font-semibold text-white">
              {result.enrichment.projectClassification.projectType}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Recommended template:{" "}
              <span className="text-zinc-200">
                {result.enrichment.projectClassification.recommendedTemplate}
              </span>
            </p>
          </ResultCard>

          <ResultCard title="Complexity">
            <p className="text-2xl font-semibold capitalize text-white">
              {result.enrichment.projectClassification.complexity}
            </p>
          </ResultCard>

          <ResultCard title="Risk Level">
            <p className="text-2xl font-semibold capitalize text-white">
              {result.enrichment.projectClassification.riskLevel}
            </p>
          </ResultCard>
        </div>

        <WorkflowTimeline steps={result.execution.steps} />
      </div>

      <div
        id="workflow-panel-systems"
        role="tabpanel"
        aria-labelledby="workflow-tab-systems"
        hidden={activeTab !== "systems"}
        className="space-y-6"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <ResultCard title="Email Notification">
            <div className="space-y-4 text-sm text-zinc-300">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={result.systems.email.status} />
                <CopyDownloadActions
                  label="Email payload"
                  filename="email-payload.json"
                  value={result.systems.email.payload}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                />
              </div>
              <IntegrationMetaCard integration={result.systems.email.integration} />
              <DefinitionList
                items={[
                  { label: "Provider", value: result.systems.email.provider },
                  {
                    label: "Recipients",
                    value: `${result.systems.email.recipients.length} recipients`,
                  },
                  { label: "Subject", value: result.systems.email.subject },
                  { label: "Status note", value: result.systems.email.message },
                ]}
              />
              <details className="rounded-xl border border-zinc-800 bg-zinc-950/80 open:border-zinc-700">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-200">
                  Recipient list
                </summary>
                <div className="border-t border-zinc-800 px-4 py-4">
                  <PeopleList
                    title="Recipients"
                    people={result.systems.email.recipients}
                  />
                </div>
              </details>
              <PayloadDisclosure
                title="Outlook payload"
                payload={result.systems.email.payload}
                filename="outlook-payload.json"
                onCopy={handleCopy}
                onDownload={handleDownload}
              />
            </div>
          </ResultCard>

          <ResultCard title="SharePoint">
            <div className="space-y-4 text-sm text-zinc-300">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={result.systems.sharepoint.status} />
              </div>
              <IntegrationMetaCard integration={result.systems.sharepoint.integration} />
              <DefinitionList
                items={[
                  { label: "Action", value: result.systems.sharepoint.action },
                  { label: "Source folder", value: result.systems.sharepoint.sourceFolder },
                  {
                    label: "Destination folder",
                    value: result.systems.sharepoint.destinationFolder,
                  },
                  { label: "Status note", value: result.systems.sharepoint.message },
                ]}
              />
            </div>
          </ResultCard>

          <ResultCard title="ClickUp">
            <div className="space-y-4 text-sm text-zinc-300">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={result.systems.clickup.status} />
                <CopyDownloadActions
                  label="ClickUp payload"
                  filename="clickup-payload.json"
                  value={result.systems.clickup.payload}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                />
              </div>
              <IntegrationMetaCard integration={result.systems.clickup.integration} />
              <DefinitionList
                items={[
                  { label: "Project", value: result.systems.clickup.projectName },
                  { label: "Space", value: result.systems.clickup.space },
                  { label: "Folder", value: result.systems.clickup.folder },
                  { label: "Owner", value: result.systems.clickup.owner },
                  { label: "Start date", value: result.systems.clickup.startDate },
                  { label: "Value", value: result.systems.clickup.value },
                ]}
              />
              <details className="rounded-xl border border-zinc-800 bg-zinc-950/80 open:border-zinc-700">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-200">
                  Tags, fields, and tasks
                </summary>
                <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Tags
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {clickupTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Custom fields
                    </p>
                    <div className="mt-3 space-y-2">
                      {result.systems.clickup.customFields.map((field) => (
                        <div
                          key={field.name}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3"
                        >
                          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                            {field.name}
                          </p>
                          <p className="mt-1 text-sm text-zinc-200">{field.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Provisioned tasks
                    </p>
                    <div className="mt-3 space-y-2">
                      {result.systems.clickup.tasks.map((task) => (
                        <div
                          key={`${task.title}-${task.owner}`}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-zinc-100">{task.title}</p>
                            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] capitalize text-zinc-300">
                              {task.priority}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-zinc-500">
                            Owner: {task.owner} | Start: {task.startDate} | Due:{" "}
                            {task.dueDate}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
              <PayloadDisclosure
                title="ClickUp payload"
                payload={result.systems.clickup.payload}
                filename="clickup-payload.json"
                onCopy={handleCopy}
                onDownload={handleDownload}
              />
            </div>
          </ResultCard>

          <ResultCard title="Teams">
            <div className="space-y-4 text-sm text-zinc-300">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={result.systems.teams.status} />
                <CopyDownloadActions
                  label="Teams payload"
                  filename="teams-payload.json"
                  value={result.systems.teams.payload}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                />
              </div>
              <IntegrationMetaCard integration={result.systems.teams.integration} />
              <DefinitionList
                items={[
                  { label: "Team", value: result.systems.teams.teamName },
                  { label: "Channel", value: result.systems.teams.channelName },
                  { label: "Visibility", value: result.systems.teams.visibility },
                  {
                    label: "Owners / members",
                    value: `${result.systems.teams.owners.length} / ${result.systems.teams.members.length}`,
                  },
                  { label: "Status note", value: result.systems.teams.message },
                ]}
              />
              <details className="rounded-xl border border-zinc-800 bg-zinc-950/80 open:border-zinc-700">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-200">
                  Owners and members
                </summary>
                <div className="grid gap-4 border-t border-zinc-800 px-4 py-4 md:grid-cols-2">
                  <PeopleList title="Owners" people={result.systems.teams.owners} />
                  <PeopleList title="Members" people={result.systems.teams.members} />
                </div>
              </details>
              <PayloadDisclosure
                title="Teams payload"
                payload={result.systems.teams.payload}
                filename="teams-payload.json"
                onCopy={handleCopy}
                onDownload={handleDownload}
              />
            </div>
          </ResultCard>
        </div>
      </div>

      <div
        id="workflow-panel-content"
        role="tabpanel"
        aria-labelledby="workflow-tab-content"
        hidden={activeTab !== "content"}
        className="space-y-6"
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <ResultCard title="Kickoff Email">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-400">
                  Final draft sent to the delivery and finance stakeholders.
                </p>
                <CopyDownloadActions
                  label="Kickoff email"
                  filename="kickoff-email.json"
                  value={result.enrichment.kickoffEmail}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                />
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Subject
                </p>
                <p className="mt-2 text-sm text-zinc-100">
                  {result.enrichment.kickoffEmail.subject}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Body
                </p>
                <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                  {result.enrichment.kickoffEmail.body}
                </pre>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="Teams Intro Message">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-400">
                  Message seeded into the kickoff channel after provisioning.
                </p>
                <CopyDownloadActions
                  label="Teams intro message"
                  filename="teams-intro-message.json"
                  value={{ teamsIntroMessage: result.enrichment.teamsIntroMessage }}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                />
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
                <pre className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                  {result.enrichment.teamsIntroMessage}
                </pre>
              </div>
            </div>
          </ResultCard>
        </div>

        <ResultCard title="Suggested ClickUp Tasks">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                Recommended starter tasks that seeded the delivery workspace.
              </p>
              <CopyDownloadActions
                label="Suggested ClickUp tasks"
                filename="clickup-tasks.json"
                value={result.enrichment.clickupTasks}
                onCopy={handleCopy}
                onDownload={handleDownload}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {result.enrichment.clickupTasks.map((task, index) => (
                <div
                  key={`${task.title}-${index}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-white">{task.title}</p>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs capitalize text-zinc-300">
                      {task.priority}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-zinc-400">{task.description}</p>
                  <p className="mt-3 text-xs text-zinc-500">
                    Owner: <span className="text-zinc-300">{task.owner}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ResultCard>
      </div>
    </section>
  );
}
