import { NextResponse } from "next/server";
import { enrichDealWithAI } from "@/lib/ai/prompts";
import type { Deal } from "@/types/deal";

export async function POST(request: Request) {
  try {
    const deal = (await request.json()) as Deal;
    const result = await enrichDealWithAI(deal);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to enrich deal with AI." },
      { status: 500 }
    );
  }
}