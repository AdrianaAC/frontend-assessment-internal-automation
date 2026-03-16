import type { Deal } from "@/types/deal";

export async function mockSharepointMove(deal: Deal) {
  return {
    status: "success",
    action: "move",
    sourceFolder: `/Propostas em Curso/${deal.clientName}`,
    destinationFolder: `/Projetos Ativos/${deal.clientName}`,
    message: `Proposal folder moved for ${deal.clientName}.`,
  };
}

export async function mockClickupProject(deal: Deal) {
  return {
    status: "success",
    projectName: `${deal.clientName} - ${deal.dealName}`,
    space: "Operations",
    folder: "Active Projects",
    message: `ClickUp project created for ${deal.clientName}.`,
  };
}

export async function mockTeamsChannel(deal: Deal) {
  return {
    status: "success",
    teamName: `${deal.clientName} Delivery Team`,
    channelName: `${deal.clientName.toLowerCase().replaceAll(" ", "-")}-kickoff`,
    message: `Teams channel created for ${deal.clientName}.`,
  };
}