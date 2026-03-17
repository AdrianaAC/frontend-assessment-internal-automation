import type { DealServiceType } from "@/types/deal";

export type PipedriveDealStatus = "open" | "won" | "lost";

export type PipedriveDealWebhookPayload = {
  meta: {
    event: "updated.deal";
    eventId: string;
    occurredAt: string;
    source: "demo-ui" | "pipedrive";
  };
  current: {
    dealId: string;
    title: string;
    clientName: string;
    value: number;
    currency: string;
    status: PipedriveDealStatus;
    stageName: string;
    ownerName: string;
    ownerEmail: string;
    projectManagerName: string;
    projectManagerEmail: string;
    sponsorName: string;
    sponsorEmail: string;
    consultantName: string;
    consultantEmail: string;
    juniorConsultantName: string;
    juniorConsultantEmail: string;
    serviceType: DealServiceType;
    startDate?: string;
    notes?: string;
  };
  previous: {
    status: PipedriveDealStatus;
    stageName: string;
  };
};
