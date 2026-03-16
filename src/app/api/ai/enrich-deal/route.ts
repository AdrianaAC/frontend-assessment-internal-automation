import { NextResponse } from "next/server";
import { validateDealInput } from "@/lib/validations/deal-schema";
import { enrichDealWithAI } from "@/lib/ai/prompts";

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

    const result = await enrichDealWithAI(validation.data);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to enrich deal with AI." },
      { status: 500 }
    );
  }
}
