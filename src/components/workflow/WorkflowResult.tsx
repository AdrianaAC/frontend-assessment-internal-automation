"use client";

import { useState } from "react";
import ResultCard from "@/components/workflow/ResultCard";
import StatusBadge from "@/components/workflow/StatusBadge";
import WorkflowTimeline from "@/components/workflow/WorkflowTimeline";
import type { WorkflowResponse } from "@/types/workflow";

type Props = {
  result: WorkflowResponse;
  onApprove?: (approval: { approvedBy: string; notes?: string }) => Promise<void>;
  approving?: boolean;
  approvalError?: string | null;
};

export default function WorkflowResult({
  result,
  onApprove,
  approving = false,
  approvalError = null,
}: Props) {
  const [approvedBy, setApprovedBy] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [localApprovalError, setLocalApprovalError] = useState<string | null>(null);

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

  function renderIntegrationMeta(integration: {
    mode: string;
    provider: string;
    liveEquivalent: string;
    note: string;
  }) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-zinc-400">
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
        <p className="mt-2">{integration.note}</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <ResultCard title="Workflow Execution">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
          <div>
            <p className="text-zinc-500">Overall status</p>
            <div className="mt-2">
              <StatusBadge status={result.execution.status} />
            </div>
          </div>
          <div>
            <p className="text-zinc-500">Total duration</p>
            <p className="mt-2 text-lg font-medium text-zinc-100">
              {result.execution.totalDurationMs} ms
            </p>
          </div>
          <div>
            <p className="text-zinc-500">Executed steps</p>
            <p className="mt-2 text-lg font-medium text-zinc-100">
              {result.execution.steps.length}
            </p>
          </div>
        </div>
      </ResultCard>

      {result.approval.status === "pending" ? (
        <ResultCard title="Human Approval">
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
              <p className="font-medium">Workflow paused before provisioning.</p>
              <p className="mt-2 text-sky-200">{result.approval.reason}.</p>
            </div>

            <form onSubmit={handleApprovalSubmit} className="space-y-4">
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
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-zinc-500"
                    value={approvedBy}
                    onChange={(event) => setApprovedBy(event.target.value)}
                    placeholder="Operations lead"
                    disabled={approving}
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

              {localApprovalError || approvalError ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {localApprovalError ?? approvalError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={approving}
                className="rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
              >
                {approving ? "Resuming..." : "Approve and continue"}
              </button>
            </form>
          </div>
        </ResultCard>
      ) : null}

      {result.approval.status === "approved" ? (
        <ResultCard title="Human Approval">
          <div className="space-y-2 text-sm text-zinc-300">
            <div className="mb-4">
              <StatusBadge status="success" />
            </div>
            <p>
              <span className="text-zinc-500">Approved by:</span>{" "}
              {result.approval.approvedBy}
            </p>
            <p>
              <span className="text-zinc-500">Approved at:</span>{" "}
              {new Date(result.approval.approvedAt).toLocaleString()}
            </p>
            <p>
              <span className="text-zinc-500">Reason:</span>{" "}
              {result.approval.reason}
            </p>
            {result.approval.notes ? (
              <p>
                <span className="text-zinc-500">Notes:</span>{" "}
                {result.approval.notes}
              </p>
            ) : null}
          </div>
        </ResultCard>
      ) : null}

      <WorkflowTimeline steps={result.execution.steps} />

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

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ResultCard title="Email Notification">
          <div className="mb-4">
            <StatusBadge status={result.systems.email.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            {renderIntegrationMeta(result.systems.email.integration)}
            <p>
              <span className="text-zinc-500">Provider:</span>{" "}
              {result.systems.email.provider}
            </p>
            <p>
              <span className="text-zinc-500">Recipients:</span>{" "}
              {result.systems.email.recipients.length}
            </p>
            <p>
              <span className="text-zinc-500">Subject:</span>{" "}
              {result.systems.email.subject}
            </p>
            <div className="pt-1">
              <p className="text-zinc-500">To / CC:</p>
              <ul className="mt-2 space-y-2">
                {result.systems.email.recipients.map((recipient) => (
                  <li
                    key={recipient.address}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <p className="text-zinc-100">{recipient.name}</p>
                    <p className="text-xs text-zinc-500">
                      {recipient.role} - {recipient.address}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-1">
              <p className="text-zinc-500">Outlook payload</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                {JSON.stringify(result.systems.email.payload, null, 2)}
              </pre>
            </div>
            <p className="pt-2 text-zinc-400">{result.systems.email.message}</p>
          </div>
        </ResultCard>

        <ResultCard title="SharePoint">
          <div className="mb-4">
            <StatusBadge status={result.systems.sharepoint.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            {renderIntegrationMeta(result.systems.sharepoint.integration)}
            <p>
              <span className="text-zinc-500">Action:</span>{" "}
              {result.systems.sharepoint.action}
            </p>
            <p>
              <span className="text-zinc-500">From:</span>{" "}
              {result.systems.sharepoint.sourceFolder}
            </p>
            <p>
              <span className="text-zinc-500">To:</span>{" "}
              {result.systems.sharepoint.destinationFolder}
            </p>
            <p className="pt-2 text-zinc-400">
              {result.systems.sharepoint.message}
            </p>
          </div>
        </ResultCard>

        <ResultCard title="ClickUp">
          <div className="mb-4">
            <StatusBadge status={result.systems.clickup.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            {renderIntegrationMeta(result.systems.clickup.integration)}
            <p>
              <span className="text-zinc-500">Project:</span>{" "}
              {result.systems.clickup.projectName}
            </p>
            <p>
              <span className="text-zinc-500">Space:</span>{" "}
              {result.systems.clickup.space}
            </p>
            <p>
              <span className="text-zinc-500">Folder:</span>{" "}
              {result.systems.clickup.folder}
            </p>
            <p>
              <span className="text-zinc-500">Owner:</span>{" "}
              {result.systems.clickup.owner}
            </p>
            <p>
              <span className="text-zinc-500">Start date:</span>{" "}
              {result.systems.clickup.startDate}
            </p>
            <p>
              <span className="text-zinc-500">Value:</span>{" "}
              {result.systems.clickup.value}
            </p>
            <div className="pt-1">
              <p className="text-zinc-500">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.systems.clickup.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-zinc-500">Custom fields</p>
              <div className="mt-2 space-y-2">
                {result.systems.clickup.customFields.map((field) => (
                  <div
                    key={field.name}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {field.name}
                    </p>
                    <p className="mt-1 text-zinc-200">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-zinc-500">Provisioned tasks</p>
              <div className="mt-2 space-y-2">
                {result.systems.clickup.tasks.map((task) => (
                  <div
                    key={`${task.title}-${task.owner}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-zinc-100">{task.title}</p>
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] capitalize text-zinc-300">
                        {task.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Owner: {task.owner} | Start: {task.startDate} | Due:{" "}
                      {task.dueDate}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-zinc-500">ClickUp payload</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                {JSON.stringify(result.systems.clickup.payload, null, 2)}
              </pre>
            </div>
            <p className="pt-2 text-zinc-400">
              {result.systems.clickup.message}
            </p>
          </div>
        </ResultCard>

        <ResultCard title="Teams">
          <div className="mb-4">
            <StatusBadge status={result.systems.teams.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            {renderIntegrationMeta(result.systems.teams.integration)}
            <p>
              <span className="text-zinc-500">Team:</span>{" "}
              {result.systems.teams.teamName}
            </p>
            <p>
              <span className="text-zinc-500">Channel:</span>{" "}
              {result.systems.teams.channelName}
            </p>
            <p>
              <span className="text-zinc-500">Visibility:</span>{" "}
              {result.systems.teams.visibility}
            </p>
            <div className="pt-1">
              <p className="text-zinc-500">Owners</p>
              <div className="mt-2 space-y-2">
                {result.systems.teams.owners.map((owner) => (
                  <div
                    key={owner.address}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <p className="text-zinc-100">{owner.name}</p>
                    <p className="text-xs text-zinc-500">
                      {owner.role} - {owner.address}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-zinc-500">Members</p>
              <div className="mt-2 space-y-2">
                {result.systems.teams.members.map((member) => (
                  <div
                    key={member.address}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <p className="text-zinc-100">{member.name}</p>
                    <p className="text-xs text-zinc-500">
                      {member.role} - {member.address}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-1">
              <p className="text-zinc-500">Teams payload</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                {JSON.stringify(result.systems.teams.payload, null, 2)}
              </pre>
            </div>
            <p className="pt-2 text-zinc-400">{result.systems.teams.message}</p>
          </div>
        </ResultCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ResultCard title="Kickoff Email">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Subject
              </p>
              <p className="mt-1 text-sm text-zinc-200">
                {result.enrichment.kickoffEmail.subject}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Body
              </p>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                {result.enrichment.kickoffEmail.body}
              </pre>
            </div>
          </div>
        </ResultCard>

        <ResultCard title="Teams Intro Message">
          <pre className="whitespace-pre-wrap text-sm text-zinc-300">
            {result.enrichment.teamsIntroMessage}
          </pre>
        </ResultCard>
      </div>

      <ResultCard title="Suggested ClickUp Tasks">
        <div className="space-y-4">
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
      </ResultCard>
    </section>
  );
}
