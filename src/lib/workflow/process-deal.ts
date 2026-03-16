import { enrichDealWithAI } from "@/lib/ai/prompts";
import {
  mockClickupProject,
  mockEmailNotification,
  mockSharepointMove,
  mockTeamsChannel,
} from "@/lib/workflow/mocks";
import type { Deal } from "@/types/deal";
import type { WorkflowResponse } from "@/types/workflow";

export async function processDeal(deal: Deal): Promise<WorkflowResponse> {
  const enrichment = await enrichDealWithAI(deal);
  const email = await mockEmailNotification(deal, enrichment);
  const sharepoint = await mockSharepointMove(deal);
  const clickup = await mockClickupProject(deal);
  const teams = await mockTeamsChannel(deal);

  return {
    deal,
    enrichment,
    systems: {
      email,
      sharepoint,
      clickup,
      teams,
    },
  };
}
