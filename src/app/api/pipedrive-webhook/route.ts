import { NextResponse } from "next/server";
import { validateDealInput } from "@/lib/validations/deal-schema";
import { processDeal } from "@/lib/workflow/process-deal";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const validation = validateDealInput(payload);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid deal payload.",
          fieldErrors: validation.errors,
        },
        { status: 400 }
      );
    }

    const result = await processDeal(validation.data);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to process deal." },
      { status: 500 }
    );
  }
}
