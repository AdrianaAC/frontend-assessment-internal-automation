import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";
import type {
  ClickupCustomField,
  ClickupTaskPayload,
  EmailRecipient,
} from "@/types/workflow";
import {
  buildChannelSlug,
  normalizeEmailAddress,
  sanitizeDisplayName,
  sanitizePathSegment,
} from "@/lib/normalization/deal-normalization";

// Removes duplicate recipients so each email address is only represented once.
function dedupeRecipients(recipients: EmailRecipient[]) {
  return recipients.filter((recipient, index, allRecipients) => {
    const normalizedAddress = normalizeEmailAddress(recipient.address);

    return (
      normalizedAddress.length > 0 &&
      allRecipients.findIndex(
        (candidate) =>
          normalizeEmailAddress(candidate.address) === normalizedAddress
      ) === index
    );
  });
}

// Collects the core delivery team members for Teams provisioning.
function buildDeliveryTeamRecipients(deal: Deal): EmailRecipient[] {
  return [
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
  ];
}

// Collects the people who should receive the kickoff notification.
function buildNotificationRecipients(deal: Deal): EmailRecipient[] {
  return dedupeRecipients([
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
      name: deal.financeName,
      address: deal.financeEmail,
      role: "Finance",
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
  ]);
}

// Calculates a future date for task scheduling when a valid start date exists.
function addDays(startDate: string | undefined, daysToAdd: number) {
  if (!startDate) {
    return "TBD";
  }

  const date = new Date(`${startDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

// Simulates the Outlook step and returns the payload that would be sent.
export async function mockEmailNotification(
  deal: Deal,
  enrichment: Pick<AIOutput, "kickoffEmail">
) {
  const recipients = buildNotificationRecipients(deal);

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

// Simulates moving the proposal folder into the active-projects area.
export async function mockSharepointMove(deal: Deal) {
  const safeClientFolder = sanitizePathSegment(deal.clientName);

  return {
    status: "success" as const,
    action: "move",
    sourceFolder: `/Propostas em Curso/${safeClientFolder}`,
    destinationFolder: `/Projetos Ativos/${safeClientFolder}`,
    message: `Proposal folder moved for ${deal.clientName}.`,
  };
}

// Simulates creating the ClickUp project, custom fields, and starter tasks.
export async function mockClickupProject(
  deal: Deal,
  enrichment: Pick<AIOutput, "clickupTasks" | "projectClassification">
) {
  const tags = [
    deal.serviceType,
    enrichment.projectClassification.complexity,
    enrichment.projectClassification.riskLevel,
  ];
  const customFields: ClickupCustomField[] = [
    {
      name: "Client",
      value: deal.clientName,
    },
    {
      name: "Deal Value",
      value: `${deal.value} ${deal.currency}`,
    },
    {
      name: "Project Manager",
      value: deal.projectManagerName,
    },
    {
      name: "Sponsor",
      value: deal.sponsorName,
    },
    {
      name: "Template",
      value: enrichment.projectClassification.recommendedTemplate,
    },
  ];
  const tasks: ClickupTaskPayload[] = enrichment.clickupTasks.map(
    (task, index) => ({
      title: task.title,
      description: task.description,
      owner: task.owner,
      priority: task.priority,
      startDate: deal.startDate ?? "TBD",
      dueDate: addDays(deal.startDate, index + 2),
      tags: [deal.serviceType, task.priority],
    })
  );
  const payload = {
    name: `${deal.clientName} - ${deal.dealName}`,
    space: "Operations",
    folder: "Active Projects",
    owner: deal.projectManagerName,
    startDate: deal.startDate ?? "TBD",
    tags,
    customFields,
    tasks,
  };

  return {
    status: "success" as const,
    projectName: payload.name,
    space: payload.space,
    folder: payload.folder,
    owner: payload.owner,
    startDate: payload.startDate,
    value: `${deal.value} ${deal.currency}`,
    tags: payload.tags,
    customFields: payload.customFields,
    tasks: payload.tasks,
    payload,
    message: `ClickUp project created for ${deal.clientName} with ${tasks.length} starter tasks and ${customFields.length} mapped fields.`,
  };
}

// Simulates provisioning the Teams workspace and kickoff channel.
export async function mockTeamsChannel(
  deal: Deal,
  enrichment: Pick<AIOutput, "teamsIntroMessage">
) {
  const members = dedupeRecipients(buildDeliveryTeamRecipients(deal));
  const owners = members.filter(
    (member) =>
      member.role === "Project Manager" || member.role === "Sales Owner"
  );
  const safeTeamName = sanitizeDisplayName(
    `${deal.clientName} Delivery Team`,
    "Delivery Team"
  );
  const safeChannelName = buildChannelSlug(deal.clientName, "kickoff");
  const payload = {
    displayName: safeTeamName,
    description: `Project workspace for ${deal.dealName} (${deal.clientName}).`,
    visibility: "private" as const,
    owners: owners.map((owner) => ({
      userPrincipalName: owner.address,
      displayName: owner.name,
    })),
    members: members.map((member) => ({
      userPrincipalName: member.address,
      displayName: member.name,
      role: member.role,
    })),
    channels: [
      {
        displayName: safeChannelName,
        membershipType: "standard" as const,
        welcomeMessage: enrichment.teamsIntroMessage,
      },
    ],
  };

  return {
    status: "success" as const,
    teamName: payload.displayName,
    channelName: safeChannelName,
    visibility: payload.visibility,
    members,
    owners,
    welcomeMessage: enrichment.teamsIntroMessage,
    payload,
    message: `Teams workspace provisioned with ${members.length} members and kickoff channel seeded with the AI-generated intro message.`,
  };
}
