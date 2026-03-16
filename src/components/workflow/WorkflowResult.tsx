"use client";

import { useState } from "react";
import type { Deal } from "@/types/deal";

type WorkflowResponse = {
  deal: Deal;
  enrichment: {
    projectClassification: {
      projectType: string;
      complexity: "low" | "medium" | "high";
      riskLevel: "low" | "medium" | "high";
      recommendedTemplate: string;
    };
    kickoffEmail: {
      subject: string;
      body: string;
    };
    teamsIntroMessage: string;
    clickupTasks: Array<{
      title: string;
      description: string;
      owner: string;
      priority: "low" | "medium" | "high";
    }>;
  };
  systems: {
    sharepoint: {
      status: string;
      action: string;
      sourceFolder: string;
      destinationFolder: string;
      message: string;
    };
    clickup: {
      status: string;
      projectName: string;
      space: string;
      folder: string;
      message: string;
    };
    teams: {
      status: string;
      teamName: string;
      channelName: string;
      message: string;
    };
  };
};

type Props = {
  onResult: (result: WorkflowResponse) => void;
};

const initialDeal: Deal = {
  dealId: "DEAL-001",
  dealName: "Digital Transformation Kickoff",
  clientName: "Acme Industries",
  value: 25000,
  currency: "EUR",
  ownerName: "Sales Owner",
  ownerEmail: "sales@company.com",
  projectManagerName: "Project Manager",
  projectManagerEmail: "pm@company.com",
  sponsorName: "Executive Sponsor",
  sponsorEmail: "sponsor@company.com",
  consultantName: "Consultant",
  consultantEmail: "consultant@company.com",
  juniorConsultantName: "Junior Consultant",
  juniorConsultantEmail: "junior@company.com",
  serviceType: "implementation",
  startDate: "2026-03-20",
  notes: "Client wants a fast kickoff and weekly reporting.",
};

export default function DealInputForm({ onResult }: Props) {
  const [deal, setDeal] = useState<Deal>(initialDeal);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);

      const response = await fetch("/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deal),
      });

      if (!response.ok) {
        throw new Error("Failed to run workflow");
      }

      const data = (await response.json()) as WorkflowResponse;
      onResult(data);
    } catch (error) {
      console.error(error);
      alert("Failed to run automation workflow.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <h2 className="mb-4 text-xl font-semibold">Deal Input</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
          value={deal.dealName}
          onChange={(e) => setDeal({ ...deal, dealName: e.target.value })}
          placeholder="Deal name"
        />

        <input
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
          value={deal.clientName}
          onChange={(e) => setDeal({ ...deal, clientName: e.target.value })}
          placeholder="Client name"
        />

        <input
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
          type="number"
          value={deal.value}
          onChange={(e) => setDeal({ ...deal, value: Number(e.target.value) })}
          placeholder="Deal value"
        />

        <select
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
          value={deal.serviceType}
          onChange={(e) =>
            setDeal({
              ...deal,
              serviceType: e.target.value as Deal["serviceType"],
            })
          }
        >
          <option value="implementation">Implementation</option>
          <option value="support">Support</option>
          <option value="audit">Audit</option>
          <option value="training">Training</option>
          <option value="unknown">Unknown</option>
        </select>

        <input
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
          value={deal.projectManagerName}
          onChange={(e) =>
            setDeal({ ...deal, projectManagerName: e.target.value })
          }
          placeholder="Project manager"
        />

        <input
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
          value={deal.consultantName}
          onChange={(e) => setDeal({ ...deal, consultantName: e.target.value })}
          placeholder="Consultant"
        />
      </div>

      <textarea
        className="mt-4 min-h-32 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3"
        value={deal.notes ?? ""}
        onChange={(e) => setDeal({ ...deal, notes: e.target.value })}
        placeholder="Additional notes"
      />

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-lg bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
      >
        {loading ? "Running..." : "Run automation"}
      </button>
    </form>
  );
}