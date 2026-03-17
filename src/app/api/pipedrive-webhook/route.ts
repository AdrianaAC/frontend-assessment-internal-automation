import { NextResponse } from "next/server";
import { validateAndMapPipedriveWebhook } from "@/lib/validations/pipedrive-webhook-schema";
import { processDeal } from "@/lib/workflow/process-deal";

const processedWebhookEvents = new Set<string>();
const processingWebhookEvents = new Set<string>();

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const validation = validateAndMapPipedriveWebhook(payload);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error,
          fieldErrors: validation.fieldErrors,
        },
        { status: 400 }
      );
    }

    if (
      processedWebhookEvents.has(validation.data.eventId) ||
      processingWebhookEvents.has(validation.data.eventId)
    ) {
      return NextResponse.json(
        {
          error: `Webhook event ${validation.data.eventId} was already processed.`,
        },
        { status: 409 }
      );
    }

    processingWebhookEvents.add(validation.data.eventId);

    try {
      const result = await processDeal(validation.data.deal);
      processingWebhookEvents.delete(validation.data.eventId);
      processedWebhookEvents.add(validation.data.eventId);

      return NextResponse.json(result);
    } catch {
      processingWebhookEvents.delete(validation.data.eventId);
      throw new Error("Failed to process deal.");
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to process deal." },
      { status: 500 }
    );
  }
}
