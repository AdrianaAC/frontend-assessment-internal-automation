import { openai } from "./openai";
import type { AIOutput } from "@/types/ai-output";
import type { Deal } from "@/types/deal";

function buildFallbackOutput(deal: Deal): AIOutput {
  return {
    projectClassification: {
      projectType: deal.serviceType,
      complexity: deal.value >= 20000 ? "high" : "medium",
      riskLevel: deal.value >= 30000 ? "high" : "medium",
      recommendedTemplate:
        deal.serviceType === "implementation"
          ? "Implementation Kickoff Template"
          : "Standard Delivery Template",
    },
    kickoffEmail: {
      subject: `Kickoff | ${deal.clientName} | ${deal.dealName}`,
      body: `Hello team,

A new deal has been marked as won.

Client: ${deal.clientName}
Project: ${deal.dealName}
Value: ${deal.value} ${deal.currency}
Project Manager: ${deal.projectManagerName}
Start Date: ${deal.startDate ?? "TBD"}

Next steps:
- Prepare SharePoint structure
- Create ClickUp project
- Add project team to Teams
- Schedule kickoff meeting

Notes:
${deal.notes ?? "No additional notes."}

Best regards,
Automation Bot`,
    },
    teamsIntroMessage: `Welcome everyone — this project for ${deal.clientName} is now starting.

Team:
- Sponsor: ${deal.sponsorName}
- Project Manager: ${deal.projectManagerName}
- Consultant: ${deal.consultantName}
- Junior Consultant: ${deal.juniorConsultantName}

Main focus:
${deal.notes ?? "No additional notes."}

Let’s use this channel for kickoff coordination and early project alignment.`,
    clickupTasks: [
      {
        title: "Create kickoff meeting",
        description: "Schedule the internal and client kickoff sessions.",
        owner: deal.projectManagerName,
        priority: "high",
      },
      {
        title: "Prepare SharePoint workspace",
        description: "Move proposal folder to active projects and validate structure.",
        owner: deal.consultantName,
        priority: "high",
      },
      {
        title: "Confirm project staffing",
        description: "Validate sponsor, PM, consultant, and junior consultant allocation.",
        owner: deal.ownerName,
        priority: "medium",
      },
    ],
  };
}

export async function enrichDealWithAI(deal: Deal): Promise<AIOutput> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    return buildFallbackOutput(deal);
  }

  const prompt = `
You are an enterprise automation assistant.

A deal has just been marked as WON.

Analyze the deal and return JSON only with this exact shape:

{
  "projectClassification": {
    "projectType": "string",
    "complexity": "low | medium | high",
    "riskLevel": "low | medium | high",
    "recommendedTemplate": "string"
  },
  "kickoffEmail": {
    "subject": "string",
    "body": "string"
  },
  "teamsIntroMessage": "string",
  "clickupTasks": [
    {
      "title": "string",
      "description": "string",
      "owner": "string",
      "priority": "low | medium | high"
    }
  ]
}

Deal:
${JSON.stringify(deal, null, 2)}
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an enterprise automation AI. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return buildFallbackOutput(deal);
    }

    return JSON.parse(content) as AIOutput;
  } catch {
    return buildFallbackOutput(deal);
  }
}