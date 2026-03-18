export type SuggestedTask = {
  title: string;
  description: string;
  owner: string;
  priority: "low" | "medium" | "high";
};

export type AIOutput = {
  projectClassification: {
    projectType: string;
    complexity: "low" | "medium" | "high";
    riskLevel: "low" | "medium" | "high";
    recommendedTemplate: string;
  };
  kickoffEmail: {
    subject: string;
    body: string;
  };
  teamsIntroMessage: string;
  clickupTasks: SuggestedTask[];
};