"use client";

import { useState } from "react";
import DealInputForm from "@/components/workflow/DealInputForm";
import WorkflowResult from "@/components/workflow/WorkflowResult";
import type { WorkflowResponse } from "@/types/workflow";

export default function HomePage() {
  const [result, setResult] = useState<WorkflowResponse | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
            AI-Enabled Internal Automation
          </p>
          <h1 className="text-4xl font-semibold">
            Won Deal - Project Kickoff Workflow
          </h1>
          <p className="max-w-3xl text-zinc-300">
            Simulate the workflow triggered when a Pipedrive deal is marked as
            won. The app enriches the deal with AI and simulates downstream
            actions for SharePoint, ClickUp, and Teams.
          </p>
        </header>

        <DealInputForm onResult={setResult} />

        {result ? <WorkflowResult result={result} /> : null}
      </div>
    </main>
  );
}
