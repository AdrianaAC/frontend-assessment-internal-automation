import { z } from "zod";
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

const requiredTrimmedString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`);

const requiredEmail = (label: string) =>
  requiredTrimmedString(label).email(`${label} must be a valid email address.`);

const serviceTypeSchema = z.enum([
  "implementation",
  "support",
  "audit",
  "training",
  "unknown",
]);

export const dealSchema = z.object({
  dealId: requiredTrimmedString("Deal ID"),
  dealName: requiredTrimmedString("Deal name"),
  clientName: requiredTrimmedString("Client name"),
  value: z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z.number().positive("Deal value must be greater than 0.")
  ),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code."),
  ownerName: requiredTrimmedString("Sales owner"),
  ownerEmail: requiredEmail("Sales owner email"),
  projectManagerName: requiredTrimmedString("Project manager"),
  projectManagerEmail: requiredEmail("Project manager email"),
  sponsorName: requiredTrimmedString("Sponsor"),
  sponsorEmail: requiredEmail("Sponsor email"),
  consultantName: requiredTrimmedString("Consultant"),
  consultantEmail: requiredEmail("Consultant email"),
  juniorConsultantName: requiredTrimmedString("Junior consultant"),
  juniorConsultantEmail: requiredEmail("Junior consultant email"),
  serviceType: serviceTypeSchema,
  startDate: z
    .string()
    .trim()
    .min(1, "Start date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format."),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

function toDealValidationErrors(error: z.ZodError<Deal>) {
  const fieldErrors = error.flatten().fieldErrors;

  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
      .map(([field, messages]) => [field, messages?.[0] ?? "Invalid value."])
  ) as DealValidationErrors;
}

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
