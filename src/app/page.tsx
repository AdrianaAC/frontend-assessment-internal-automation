"use client";

import { useState } from "react";
import DealInputForm from "@/components/workflow/DealInputForm";
import WorkflowResult from "@/components/workflow/WorkflowResult";
import type { WorkflowRunResponse } from "@/types/workflow";

// Renders the main workflow demo and coordinates approval actions from the browser.
export default function HomePage() {
  const [result, setResult] = useState<WorkflowRunResponse | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  // Sends the human approval decision back to the server to resume the workflow.
  async function handleApprove(approval: {
    approvedBy: string;
    notes?: string;
  }) {
    if (!result) {
      return;
    }

    try {
      setApproving(true);
      setApprovalError(null);

      const response = await fetch("/api/workflow/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowRunId: result.workflowRunId,
          approval,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
          }
        | WorkflowRunResponse
        | null;

      if (!response.ok) {
        setApprovalError(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Failed to resume workflow."
        );
        return;
      }

      setResult(payload as WorkflowRunResponse);
    } catch (error) {
      console.error(error);
      setApprovalError("Failed to resume workflow.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <main className="app-shell min-h-screen px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="hero-glow glass-panel section-fade-in rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10">
          <div className="relative z-10 grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-amber-200">
                  Automation Control Room
                </span>
                <span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-teal-200">
                  AI-Enabled Workflow
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-sm uppercase tracking-[0.28em] text-zinc-500">
                  Internal Delivery Activation
                </p>
                <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
                  Won Deal to Kickoff, framed like an operations cockpit instead
                  of a demo form.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
                  Trigger the post-sale workflow, review AI classification, gate
                  risky runs with approval, and inspect every downstream payload
                  across Outlook, SharePoint, ClickUp, and Teams.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Intake
                </p>
                <p className="mt-2 text-sm text-zinc-200">
                  Simulated Pipedrive won-deal webhook with strict validation.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Decisioning
                </p>
                <p className="mt-2 text-sm text-zinc-200">
                  AI enrichment with fallback, observability, and approval gates.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Provisioning
                </p>
                <p className="mt-2 text-sm text-zinc-200">
                  Payload-ready simulations for delivery systems and comms.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="section-fade-in">
          <DealInputForm onResult={setResult} />
        </section>

        {result ? (
          <section className="section-fade-in">
            <WorkflowResult
              result={result}
              onApprove={handleApprove}
              approving={approving}
              approvalError={approvalError}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
