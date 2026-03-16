import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";
import type { EmailRecipient } from "@/types/workflow";

export async function mockEmailNotification(
  deal: Deal,
  enrichment: Pick<AIOutput, "kickoffEmail">
) {
  const recipients: EmailRecipient[] = [
    {
      name: deal.ownerName,
      address: deal.ownerEmail,
      role: "Sales Owner",
    },
    {
      name: deal.projectManagerName,
      address: deal.projectManagerEmail,
      role: "Project Manager",
    },
    {
      name: deal.sponsorName,
      address: deal.sponsorEmail,
      role: "Sponsor",
    },
    {
      name: deal.consultantName,
      address: deal.consultantEmail,
      role: "Consultant",
    },
    {
      name: deal.juniorConsultantName,
      address: deal.juniorConsultantEmail,
      role: "Junior Consultant",
    },
  ].filter((recipient, index, allRecipients) => {
    return (
      recipient.address.trim().length > 0 &&
      allRecipients.findIndex(
        (candidate) => candidate.address === recipient.address
      ) === index
    );
  });

  const [primaryRecipient, ...ccRecipients] = recipients;
  const payload = {
    message: {
      subject: enrichment.kickoffEmail.subject,
      body: {
        contentType: "Text" as const,
        content: enrichment.kickoffEmail.body,
      },
      toRecipients: primaryRecipient
        ? [
            {
              emailAddress: {
                name: primaryRecipient.name,
                address: primaryRecipient.address,
              },
            },
          ]
        : [],
      ccRecipients: ccRecipients.map((recipient) => ({
        emailAddress: {
          name: recipient.name,
          address: recipient.address,
        },
      })),
      importance: "normal" as const,
    },
    saveToSentItems: true,
  };

  const recipientSummary = recipients
    .map((recipient) => `${recipient.name} <${recipient.address}>`)
    .join(", ");

  return {
    status: "success" as const,
    provider: "Office365 / Outlook",
    recipients,
    subject: enrichment.kickoffEmail.subject,
    bodyPreview: enrichment.kickoffEmail.body,
    payload,
    message: `Kickoff notification prepared for ${recipientSummary}.`,
  };
}

export async function mockSharepointMove(deal: Deal) {
  return {
    status: "success" as const,
    action: "move",
    sourceFolder: `/Propostas em Curso/${deal.clientName}`,
    destinationFolder: `/Projetos Ativos/${deal.clientName}`,
    message: `Proposal folder moved for ${deal.clientName}.`,
  };
}

export async function mockClickupProject(deal: Deal) {
  return {
    status: "success" as const,
    projectName: `${deal.clientName} - ${deal.dealName}`,
    space: "Operations",
    folder: "Active Projects",
    message: `ClickUp project created for ${deal.clientName}.`,
  };
}

export async function mockTeamsChannel(deal: Deal) {
  return {
    status: "success" as const,
    teamName: `${deal.clientName} Delivery Team`,
    channelName: `${deal.clientName.toLowerCase().replaceAll(" ", "-")}-kickoff`,
    message: `Teams channel created for ${deal.clientName}.`,
  };
}
