import { z } from "zod";
import {
  isValidISODateString,
  normalizeEmailAddress,
  normalizeISODateString,
} from "@/lib/normalization/deal-normalization";
import type { Deal } from "@/types/deal";

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

// Builds a required text validator with a readable label and max length.
const requiredTrimmedString = (label: string, maxLength = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`);

// Builds an email validator that also normalizes the final address.
const requiredEmail = (label: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254, `${label} must be 254 characters or fewer.`)
    .email(`${label} must be a valid email address.`)
    .transform((value) => normalizeEmailAddress(value));

const serviceTypeSchema = z.enum([
  "implementation",
  "support",
  "audit",
  "training",
  "unknown",
]);

export const dealSchema = z.object({
  dealId: requiredTrimmedString("Deal ID", 64),
  dealName: requiredTrimmedString("Deal name", 140),
  clientName: requiredTrimmedString("Client name", 120),
  value: z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z.number().positive("Deal value must be greater than 0.")
  ),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code."),
  ownerName: requiredTrimmedString("Sales owner", 100),
  ownerEmail: requiredEmail("Sales owner email"),
  financeName: requiredTrimmedString("Finance contact", 100),
  financeEmail: requiredEmail("Finance contact email"),
  projectManagerName: requiredTrimmedString("Project manager", 100),
  projectManagerEmail: requiredEmail("Project manager email"),
  sponsorName: requiredTrimmedString("Sponsor", 100),
  sponsorEmail: requiredEmail("Sponsor email"),
  consultantName: requiredTrimmedString("Consultant", 100),
  consultantEmail: requiredEmail("Consultant email"),
  juniorConsultantName: requiredTrimmedString("Junior consultant", 100),
  juniorConsultantEmail: requiredEmail("Junior consultant email"),
  serviceType: serviceTypeSchema,
  startDate: z
    .string()
    .trim()
    .min(1, "Start date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format.")
    .refine(isValidISODateString, "Start date must be a real calendar date.")
    .transform((value) => normalizeISODateString(value)),
  notes: z
    .string()
    .trim()
    .max(2000, "Additional notes must be 2000 characters or fewer.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

// Converts Zod field errors into the simpler shape used by the UI.
function toDealValidationErrors(error: z.ZodError<Deal>) {
  const fieldErrors = error.flatten().fieldErrors;

  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
      .map(([field, messages]) => [field, messages?.[0] ?? "Invalid value."])
  ) as DealValidationErrors;
}

// Validates arbitrary input and returns either a clean deal or user-facing field errors.
export function validateDealInput(input: unknown): DealValidationResult {
  const validation = dealSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      errors: toDealValidationErrors(validation.error),
    };
  }

  return {
    success: true,
    data: validation.data,
  };
}
