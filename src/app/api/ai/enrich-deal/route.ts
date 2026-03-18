import {
  buildCorrelationContext,
  createJsonResponse,
  getErrorDetails,
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability/logger";
import { validateDealInput } from "@/lib/validations/deal-schema";
import { enrichDealWithAI } from "@/lib/ai/prompts";

// Validates a deal payload and returns AI-generated enrichment for preview or testing.
export async function POST(request: Request) {
  const startedAt = Date.now();
  const correlation = buildCorrelationContext(request, {
    route: "/api/ai/enrich-deal",
  });

  logInfo("api.request.received", correlation);

  try {
    const payload = await request.json();
    const validation = validateDealInput(payload);

    if (!validation.success) {
      logWarn("api.request.validation_failed", {
        ...correlation,
        durationMs: Date.now() - startedAt,
        error: "Invalid deal payload.",
        fieldErrors: validation.errors,
      });

      return createJsonResponse(
        {
          error: "Invalid deal payload.",
          fieldErrors: validation.errors,
        },
        { status: 400 },
        correlation.correlationId
      );
    }

    const result = await enrichDealWithAI(validation.data, correlation);

    logInfo("api.request.completed", {
      ...correlation,
      dealId: validation.data.dealId,
      durationMs: Date.now() - startedAt,
      statusCode: 200,
    });

    return createJsonResponse(result, { status: 200 }, correlation.correlationId);
  } catch (error) {
    logError("api.request.failed", {
      ...correlation,
      durationMs: Date.now() - startedAt,
      error: getErrorDetails(error),
    });

    return createJsonResponse(
      { error: "Failed to enrich deal with AI." },
      { status: 500 },
      correlation.correlationId
    );
  }
}
