"use client";

import { useState } from "react";
import {
  validateDealInput,
  type DealField,
  type DealValidationErrors,
} from "@/lib/validations/deal-schema";
import type { Deal } from "@/types/deal";
import type { PipedriveDealWebhookPayload } from "@/types/pipedrive";
import type { WorkflowResponse } from "@/types/workflow";

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
  financeName: "Finance Partner",
  financeEmail: "finance@company.com",
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

const baseFieldClassName =
  "w-full rounded-lg border bg-zinc-950 px-4 py-3 text-zinc-100 outline-none transition focus:border-zinc-500";

function buildSimulatedWebhookPayload(deal: Deal): PipedriveDealWebhookPayload {
  const occurredAt = new Date().toISOString();

  return {
    meta: {
      event: "updated.deal",
      eventId: `${deal.dealId}:won:${occurredAt}`,
      occurredAt,
      source: "demo-ui",
    },
    current: {
      dealId: deal.dealId,
      title: deal.dealName,
      clientName: deal.clientName,
      value: deal.value,
      currency: deal.currency,
      status: "won",
      stageName: "Won",
      ownerName: deal.ownerName,
      ownerEmail: deal.ownerEmail,
      financeName: deal.financeName,
      financeEmail: deal.financeEmail,
      projectManagerName: deal.projectManagerName,
      projectManagerEmail: deal.projectManagerEmail,
      sponsorName: deal.sponsorName,
      sponsorEmail: deal.sponsorEmail,
      consultantName: deal.consultantName,
      consultantEmail: deal.consultantEmail,
      juniorConsultantName: deal.juniorConsultantName,
      juniorConsultantEmail: deal.juniorConsultantEmail,
      serviceType: deal.serviceType,
      startDate: deal.startDate,
      notes: deal.notes,
    },
    previous: {
      status: "open",
      stageName: "Proposal Review",
    },
  };
}

export default function DealInputForm({ onResult }: Props) {
  const [deal, setDeal] = useState<Deal>(initialDeal);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<DealValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function updateDeal<Key extends keyof Deal>(key: Key, value: Deal[Key]) {
    setDeal((currentDeal) => ({ ...currentDeal, [key]: value }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors[key]) {
        return currentErrors;
      }

      return {
        ...currentErrors,
        [key]: undefined,
      };
    });
    setFormError(null);
  }

  function getFieldClassName(field: DealField) {
    return `${baseFieldClassName} ${
      fieldErrors[field]
        ? "border-rose-500/70 focus:border-rose-400"
        : "border-zinc-700"
    }`;
  }

  function renderFieldError(field: DealField) {
    const error = fieldErrors[field];

    if (!error) {
      return null;
    }

    return <p className="mt-2 text-sm text-rose-400">{error}</p>;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateDealInput(deal);

    if (!validation.success) {
      setFieldErrors(validation.errors);
      setFormError("Review the highlighted fields before running the workflow.");
      return;
    }

    try {
      setLoading(true);
      setFieldErrors({});
      setFormError(null);
      setDeal(validation.data);

      const response = await fetch("/api/pipedrive-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildSimulatedWebhookPayload(validation.data)),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            fieldErrors?: DealValidationErrors;
          }
        | WorkflowResponse
        | null;

      if (!response.ok) {
        if (
          payload &&
          "fieldErrors" in payload &&
          payload.fieldErrors
        ) {
          setFieldErrors(payload.fieldErrors);
        }

        setFormError(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Failed to run automation workflow."
        );
        return;
      }

      onResult(payload as WorkflowResponse);
    } catch (error) {
      console.error(error);
      setFormError("Failed to run automation workflow.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      noValidate
    >
      <div className="mb-6 space-y-2">
        <h2 className="text-xl font-semibold">Deal Input</h2>
        <p className="text-sm text-zinc-400">
          Edit the full delivery team and notification recipients to simulate a
          Pipedrive updated.deal webhook transitioning from open to won.
        </p>
      </div>

      {formError ? (
        <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {formError}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">
              Deal Details
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="dealName">
                Deal name
              </label>
              <input
                id="dealName"
                className={getFieldClassName("dealName")}
                value={deal.dealName}
                onChange={(e) => updateDeal("dealName", e.target.value)}
                placeholder="Deal name"
                required
                aria-invalid={Boolean(fieldErrors.dealName)}
              />
              {renderFieldError("dealName")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="clientName">
                Client name
              </label>
              <input
                id="clientName"
                className={getFieldClassName("clientName")}
                value={deal.clientName}
                onChange={(e) => updateDeal("clientName", e.target.value)}
                placeholder="Client name"
                required
                aria-invalid={Boolean(fieldErrors.clientName)}
              />
              {renderFieldError("clientName")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="dealId">
                Deal ID
              </label>
              <input
                id="dealId"
                className={getFieldClassName("dealId")}
                value={deal.dealId}
                onChange={(e) => updateDeal("dealId", e.target.value)}
                placeholder="Deal ID"
                required
                aria-invalid={Boolean(fieldErrors.dealId)}
              />
              {renderFieldError("dealId")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="startDate">
                Start date
              </label>
              <input
                id="startDate"
                className={getFieldClassName("startDate")}
                type="date"
                value={deal.startDate ?? ""}
                onChange={(e) => updateDeal("startDate", e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.startDate)}
              />
              {renderFieldError("startDate")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="value">
                Deal value
              </label>
              <input
                id="value"
                className={getFieldClassName("value")}
                type="number"
                min="1"
                value={deal.value}
                onChange={(e) => updateDeal("value", Number(e.target.value))}
                placeholder="Deal value"
                required
                aria-invalid={Boolean(fieldErrors.value)}
              />
              {renderFieldError("value")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="currency">
                Currency
              </label>
              <input
                id="currency"
                className={getFieldClassName("currency")}
                value={deal.currency}
                onChange={(e) => updateDeal("currency", e.target.value)}
                placeholder="EUR"
                maxLength={3}
                required
                aria-invalid={Boolean(fieldErrors.currency)}
              />
              {renderFieldError("currency")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="serviceType">
                Service type
              </label>
              <select
                id="serviceType"
                className={getFieldClassName("serviceType")}
                value={deal.serviceType}
                onChange={(e) =>
                  updateDeal("serviceType", e.target.value as Deal["serviceType"])
                }
                required
                aria-invalid={Boolean(fieldErrors.serviceType)}
              >
                <option value="implementation">Implementation</option>
                <option value="support">Support</option>
                <option value="audit">Audit</option>
                <option value="training">Training</option>
                <option value="unknown">Unknown</option>
              </select>
              {renderFieldError("serviceType")}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">
              Team And Notifications
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              These contacts are used for the Outlook notification and Teams
              kickoff setup.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="ownerName">
                Sales owner
              </label>
              <input
                id="ownerName"
                className={getFieldClassName("ownerName")}
                value={deal.ownerName}
                onChange={(e) => updateDeal("ownerName", e.target.value)}
                placeholder="Sales owner"
                required
                aria-invalid={Boolean(fieldErrors.ownerName)}
              />
              {renderFieldError("ownerName")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="ownerEmail">
                Sales owner email
              </label>
              <input
                id="ownerEmail"
                className={getFieldClassName("ownerEmail")}
                type="email"
                value={deal.ownerEmail}
                onChange={(e) => updateDeal("ownerEmail", e.target.value)}
                placeholder="sales.owner@company.com"
                required
                aria-invalid={Boolean(fieldErrors.ownerEmail)}
              />
              {renderFieldError("ownerEmail")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="financeName"
              >
                Finance contact
              </label>
              <input
                id="financeName"
                className={getFieldClassName("financeName")}
                value={deal.financeName}
                onChange={(e) => updateDeal("financeName", e.target.value)}
                placeholder="Finance contact"
                required
                aria-invalid={Boolean(fieldErrors.financeName)}
              />
              {renderFieldError("financeName")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="financeEmail"
              >
                Finance contact email
              </label>
              <input
                id="financeEmail"
                className={getFieldClassName("financeEmail")}
                type="email"
                value={deal.financeEmail}
                onChange={(e) => updateDeal("financeEmail", e.target.value)}
                placeholder="finance@company.com"
                required
                aria-invalid={Boolean(fieldErrors.financeEmail)}
              />
              {renderFieldError("financeEmail")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="projectManagerName"
              >
                Project manager
              </label>
              <input
                id="projectManagerName"
                className={getFieldClassName("projectManagerName")}
                value={deal.projectManagerName}
                onChange={(e) => updateDeal("projectManagerName", e.target.value)}
                placeholder="Project manager"
                required
                aria-invalid={Boolean(fieldErrors.projectManagerName)}
              />
              {renderFieldError("projectManagerName")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="projectManagerEmail"
              >
                Project manager email
              </label>
              <input
                id="projectManagerEmail"
                className={getFieldClassName("projectManagerEmail")}
                type="email"
                value={deal.projectManagerEmail}
                onChange={(e) => updateDeal("projectManagerEmail", e.target.value)}
                placeholder="project.manager@company.com"
                required
                aria-invalid={Boolean(fieldErrors.projectManagerEmail)}
              />
              {renderFieldError("projectManagerEmail")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="sponsorName">
                Sponsor
              </label>
              <input
                id="sponsorName"
                className={getFieldClassName("sponsorName")}
                value={deal.sponsorName}
                onChange={(e) => updateDeal("sponsorName", e.target.value)}
                placeholder="Sponsor"
                required
                aria-invalid={Boolean(fieldErrors.sponsorName)}
              />
              {renderFieldError("sponsorName")}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400" htmlFor="sponsorEmail">
                Sponsor email
              </label>
              <input
                id="sponsorEmail"
                className={getFieldClassName("sponsorEmail")}
                type="email"
                value={deal.sponsorEmail}
                onChange={(e) => updateDeal("sponsorEmail", e.target.value)}
                placeholder="sponsor@company.com"
                required
                aria-invalid={Boolean(fieldErrors.sponsorEmail)}
              />
              {renderFieldError("sponsorEmail")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="consultantName"
              >
                Consultant
              </label>
              <input
                id="consultantName"
                className={getFieldClassName("consultantName")}
                value={deal.consultantName}
                onChange={(e) => updateDeal("consultantName", e.target.value)}
                placeholder="Consultant"
                required
                aria-invalid={Boolean(fieldErrors.consultantName)}
              />
              {renderFieldError("consultantName")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="consultantEmail"
              >
                Consultant email
              </label>
              <input
                id="consultantEmail"
                className={getFieldClassName("consultantEmail")}
                type="email"
                value={deal.consultantEmail}
                onChange={(e) => updateDeal("consultantEmail", e.target.value)}
                placeholder="consultant@company.com"
                required
                aria-invalid={Boolean(fieldErrors.consultantEmail)}
              />
              {renderFieldError("consultantEmail")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="juniorConsultantName"
              >
                Junior consultant
              </label>
              <input
                id="juniorConsultantName"
                className={getFieldClassName("juniorConsultantName")}
                value={deal.juniorConsultantName}
                onChange={(e) =>
                  updateDeal("juniorConsultantName", e.target.value)
                }
                placeholder="Junior consultant"
                required
                aria-invalid={Boolean(fieldErrors.juniorConsultantName)}
              />
              {renderFieldError("juniorConsultantName")}
            </div>

            <div>
              <label
                className="mb-2 block text-sm text-zinc-400"
                htmlFor="juniorConsultantEmail"
              >
                Junior consultant email
              </label>
              <input
                id="juniorConsultantEmail"
                className={getFieldClassName("juniorConsultantEmail")}
                type="email"
                value={deal.juniorConsultantEmail}
                onChange={(e) =>
                  updateDeal("juniorConsultantEmail", e.target.value)
                }
                placeholder="junior.consultant@company.com"
                required
                aria-invalid={Boolean(fieldErrors.juniorConsultantEmail)}
              />
              {renderFieldError("juniorConsultantEmail")}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm text-zinc-400" htmlFor="notes">
          Additional notes
        </label>
        <textarea
          id="notes"
          className={getFieldClassName("notes")}
          value={deal.notes ?? ""}
          onChange={(e) => updateDeal("notes", e.target.value)}
          placeholder="Additional notes"
          rows={5}
          aria-invalid={Boolean(fieldErrors.notes)}
        />
        {renderFieldError("notes")}
      </div>

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
