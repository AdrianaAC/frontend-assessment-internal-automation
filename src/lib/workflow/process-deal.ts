import { enrichDealWithAI } from "@/lib/ai/prompts";
import {
  mockClickupProject,
  mockSharepointMove,
  mockTeamsChannel,
} from "@/lib/workflow/mocks";
import type { Deal } from "@/types/deal";

export async function processDeal(deal: Deal) {
  const enrichment = await enrichDealWithAI(deal);
  const sharepoint = await mockSharepointMove(deal);
  const clickup = await mockClickupProject(deal);
  const teams = await mockTeamsChannel(deal);

  return {
    deal,
    enrichment,
    systems: {
      sharepoint,
      clickup,
      teams,
    },
  };
}