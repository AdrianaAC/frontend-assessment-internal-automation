import { NextResponse } from "next/server";
import { processDeal } from "@/lib/workflow/process-deal";
import type { Deal } from "@/types/deal";

export async function POST(request: Request) {
  try {
    const deal = (await request.json()) as Deal;
    const result = await processDeal(deal);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to process deal." },
      { status: 500 }
    );
  }
}