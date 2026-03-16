export type DealServiceType =
  | "implementation"
  | "support"
  | "audit"
  | "training"
  | "unknown";

export type Deal = {
  dealId: string;
  dealName: string;
  clientName: string;
  value: number;
  currency: string;
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