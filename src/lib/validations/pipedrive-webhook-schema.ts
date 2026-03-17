import { validateDealInput, type DealValidationErrors } from "@/lib/validations/deal-schema";
import type { Deal } from "@/types/deal";
import type { PipedriveDealStatus } from "@/types/pipedrive";

type PipedriveWebhookValidationSuccess = {
  success: true;
  data: {
    eventId: string;
    occurredAt: string;
    deal: Deal;
  };
};

type PipedriveWebhookValidationFailure = {
  success: false;
  error: string;
  fieldErrors?: DealValidationErrors;
};

export type PipedriveWebhookValidationResult =
  | PipedriveWebhookValidationSuccess
  | PipedriveWebhookValidationFailure;

const validStatuses = new Set<PipedriveDealStatus>(["open", "won", "lost"]);

function readRequiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function validateAndMapPipedriveWebhook(
  input: unknown
): PipedriveWebhookValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      error: "Invalid Pipedrive webhook payload.",
    };
  }

  const source = input as Record<string, unknown>;
  const meta = source.meta;
  const current = source.current;
  const previous = source.previous;

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {
      success: false,
      error: "Webhook meta is missing.",
    };
  }

  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return {
      success: false,
      error: "Webhook current payload is missing.",
    };
  }

  if (!previous || typeof previous !== "object" || Array.isArray(previous)) {
    return {
      success: false,
      error: "Webhook previous payload is missing.",
    };
  }

  const metaSource = meta as Record<string, unknown>;
  const currentSource = current as Record<string, unknown>;
  const previousSource = previous as Record<string, unknown>;

  const event = readRequiredString(metaSource.event);
  const eventId = readRequiredString(metaSource.eventId);
  const occurredAt = readRequiredString(metaSource.occurredAt);
  const currentStatus = readRequiredString(currentSource.status);
  const previousStatus = readRequiredString(previousSource.status);

  if (event !== "updated.deal") {
    return {
      success: false,
      error: "Webhook event must be updated.deal.",
    };
  }

  if (!eventId) {
    return {
      success: false,
      error: "Webhook eventId is required.",
    };
  }

  if (!occurredAt) {
    return {
      success: false,
      error: "Webhook occurredAt is required.",
    };
  }

  if (!currentStatus || !validStatuses.has(currentStatus as PipedriveDealStatus)) {
    return {
      success: false,
      error: "Current deal status is invalid.",
    };
  }

  if (!previousStatus || !validStatuses.has(previousStatus as PipedriveDealStatus)) {
    return {
      success: false,
      error: "Previous deal status is invalid.",
    };
  }

  if (currentStatus !== "won") {
    return {
      success: false,
      error: "Webhook does not represent a won deal.",
    };
  }

  if (previousStatus === "won") {
    return {
      success: false,
      error: "Webhook does not represent a transition into won.",
    };
  }

  const mappedDealInput = {
    dealId: currentSource.dealId,
    dealName: currentSource.title,
    clientName: currentSource.clientName,
    value: currentSource.value,
    currency: currentSource.currency,
    ownerName: currentSource.ownerName,
    ownerEmail: currentSource.ownerEmail,
    projectManagerName: currentSource.projectManagerName,
    projectManagerEmail: currentSource.projectManagerEmail,
    sponsorName: currentSource.sponsorName,
    sponsorEmail: currentSource.sponsorEmail,
    consultantName: currentSource.consultantName,
    consultantEmail: currentSource.consultantEmail,
    juniorConsultantName: currentSource.juniorConsultantName,
    juniorConsultantEmail: currentSource.juniorConsultantEmail,
    serviceType: currentSource.serviceType,
    startDate: currentSource.startDate,
    notes: currentSource.notes,
  };

  const dealValidation = validateDealInput(mappedDealInput);

  if (!dealValidation.success) {
    return {
      success: false,
      error: "Webhook current payload is invalid.",
      fieldErrors: dealValidation.errors,
    };
  }

  return {
    success: true,
    data: {
      eventId,
      occurredAt,
      deal: dealValidation.data,
    },
  };
}
