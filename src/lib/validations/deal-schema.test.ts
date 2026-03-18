import { describe, expect, it } from "vitest";
import { validateDealInput } from "@/lib/validations/deal-schema";
import { createDealFixture } from "@/test/fixtures";

describe("validateDealInput", () => {
  it("normalizes email addresses and currency casing", () => {
    const result = validateDealInput(
      createDealFixture({
        ownerEmail: " SALES@COMPANY.COM ",
        financeEmail: " Finance@Company.Com ",
        currency: "eur",
      })
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        ownerEmail: "sales@company.com",
        financeEmail: "finance@company.com",
        currency: "EUR",
      },
    });
  });

  it("rejects impossible calendar dates", () => {
    const result = validateDealInput(
      createDealFixture({
        startDate: "2026-02-30",
      })
    );

    expect(result).toEqual({
      success: false,
      errors: {
        startDate: "Start date must be a real calendar date.",
      },
    });
  });

  it("rejects notes that exceed the maximum length", () => {
    const result = validateDealInput(
      createDealFixture({
        notes: "x".repeat(2001),
      })
    );

    expect(result).toEqual({
      success: false,
      errors: {
        notes: "Additional notes must be 2000 characters or fewer.",
      },
    });
  });
});
