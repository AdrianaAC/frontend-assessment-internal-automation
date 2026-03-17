import { NextResponse } from "next/server";
import { validateWorkflowResumeInput } from "@/lib/validations/workflow-resume-schema";
import { processDeal } from "@/lib/workflow/process-deal";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const validation = validateWorkflowResumeInput(payload);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error,
          details: validation.details,
        },
        { status: 400 }
      );
    }

    const result = await processDeal(validation.data.deal, {
      enrichmentContext: validation.data.enrichmentContext,
      enrichmentOverride: validation.data.enrichment,
      approvalDecision: validation.data.approval,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to resume workflow." },
      { status: 500 }
    );
  }
}
