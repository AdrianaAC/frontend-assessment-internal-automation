import type { Deal, DealServiceType } from "@/types/deal";

export type DealField = keyof Deal;
export type DealValidationErrors = Partial<Record<DealField, string>>;

type DealValidationSuccess = {
  success: true;
  data: Deal;
};

type DealValidationFailure = {
  success: false;
  errors: DealValidationErrors;
};

export type DealValidationResult =
  | DealValidationSuccess
  | DealValidationFailure;

const validServiceTypes = new Set<DealServiceType>([
  "implementation",
  "support",
  "audit",
  "training",
  "unknown",
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function readRequiredString(
  source: Record<string, unknown>,
  field: DealField,
  label: string,
  errors: DealValidationErrors
) {
  const value = source[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors[field] = `${label} is required.`;
    return "";
  }

  return value.trim();
}

function readOptionalString(
  source: Record<string, unknown>,
  field: DealField,
  errors: DealValidationErrors
) {
  const value = source[field];

  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    errors[field] = "Invalid value.";
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function validateEmail(
  source: Record<string, unknown>,
  field: DealField,
  label: string,
  errors: DealValidationErrors
) {
  const value = readRequiredString(source, field, label, errors);

  if (value && !emailPattern.test(value)) {
    errors[field] = `${label} must be a valid email address.`;
  }

  return value;
}

export function validateDealInput(input: unknown): DealValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      errors: {
        dealId: "Invalid deal payload.",
      },
    };
  }

  const source = input as Record<string, unknown>;
  const errors: DealValidationErrors = {};

  const dealId = readRequiredString(source, "dealId", "Deal ID", errors);
  const dealName = readRequiredString(source, "dealName", "Deal name", errors);
  const clientName = readRequiredString(
    source,
    "clientName",
    "Client name",
    errors
  );
  const currency = readRequiredString(source, "currency", "Currency", errors);
  const ownerName = readRequiredString(
    source,
    "ownerName",
    "Sales owner",
    errors
  );
  const ownerEmail = validateEmail(
    source,
    "ownerEmail",
    "Sales owner email",
    errors
  );
  const projectManagerName = readRequiredString(
    source,
    "projectManagerName",
    "Project manager",
    errors
  );
  const projectManagerEmail = validateEmail(
    source,
    "projectManagerEmail",
    "Project manager email",
    errors
  );
  const sponsorName = readRequiredString(
    source,
    "sponsorName",
    "Sponsor",
    errors
  );
  const sponsorEmail = validateEmail(
    source,
    "sponsorEmail",
    "Sponsor email",
    errors
  );
  const consultantName = readRequiredString(
    source,
    "consultantName",
    "Consultant",
    errors
  );
  const consultantEmail = validateEmail(
    source,
    "consultantEmail",
    "Consultant email",
    errors
  );
  const juniorConsultantName = readRequiredString(
    source,
    "juniorConsultantName",
    "Junior consultant",
    errors
  );
  const juniorConsultantEmail = validateEmail(
    source,
    "juniorConsultantEmail",
    "Junior consultant email",
    errors
  );

  const rawValue = source.value;
  const value =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? Number(rawValue)
        : Number.NaN;

  if (!Number.isFinite(value) || value <= 0) {
    errors.value = "Deal value must be greater than 0.";
  }

  if (currency && currency.length !== 3) {
    errors.currency = "Currency must be a 3-letter code.";
  }

  const rawServiceType = source.serviceType;
  const serviceType =
    typeof rawServiceType === "string" ? rawServiceType.trim() : "";

  if (!validServiceTypes.has(serviceType as DealServiceType)) {
    errors.serviceType = "Service type is invalid.";
  }

  const startDate = readOptionalString(source, "startDate", errors);

  if (!startDate) {
    errors.startDate = "Start date is required.";
  } else if (!datePattern.test(startDate)) {
    errors.startDate = "Start date must be in YYYY-MM-DD format.";
  }

  const notes = readOptionalString(source, "notes", errors);

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      dealId,
      dealName,
      clientName,
      value,
      currency: currency.toUpperCase(),
      ownerName,
      ownerEmail,
      projectManagerName,
      projectManagerEmail,
      sponsorName,
      sponsorEmail,
      consultantName,
      consultantEmail,
      juniorConsultantName,
      juniorConsultantEmail,
      serviceType: serviceType as DealServiceType,
      startDate,
      notes,
    },
  };
}
