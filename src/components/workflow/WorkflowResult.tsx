import ResultCard from "@/components/workflow/ResultCard";
import StatusBadge from "@/components/workflow/StatusBadge";
import WorkflowTimeline from "@/components/workflow/WorkflowTimeline";
import type { WorkflowResponse } from "@/types/workflow";

type Props = {
  result: WorkflowResponse;
};

export default function WorkflowResult({ result }: Props) {
  const timelineSteps = [
    {
      title: "Deal Received",
      description: `The won deal "${result.deal.dealName}" for ${result.deal.clientName} entered the automation workflow.`,
      status: "success" as const,
    },
    {
      title: "AI Enrichment",
      description: `The AI agent classified the project as ${result.enrichment.projectClassification.projectType}, assessed complexity as ${result.enrichment.projectClassification.complexity}, and generated kickoff communication plus starter tasks.`,
      status: "success" as const,
    },
    {
      title: "Email Notification",
      description: result.systems.email.message,
      status: result.systems.email.status,
    },
    {
      title: "SharePoint Setup",
      description: result.systems.sharepoint.message,
      status:
        result.systems.sharepoint.status === "success" ? "success" : "error",
    },
    {
      title: "ClickUp Project Creation",
      description: result.systems.clickup.message,
      status: result.systems.clickup.status === "success" ? "success" : "error",
    },
    {
      title: "Teams Channel Provisioning",
      description: result.systems.teams.message,
      status: result.systems.teams.status === "success" ? "success" : "error",
    },
  ];

  return (
    <section className="space-y-6">
      <WorkflowTimeline steps={timelineSteps} />

      <div className="grid gap-6 md:grid-cols-3">
        <ResultCard title="Project Type">
          <p className="text-2xl font-semibold text-white">
            {result.enrichment.projectClassification.projectType}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Recommended template:{" "}
            <span className="text-zinc-200">
              {result.enrichment.projectClassification.recommendedTemplate}
            </span>
          </p>
        </ResultCard>

        <ResultCard title="Complexity">
          <p className="text-2xl font-semibold capitalize text-white">
            {result.enrichment.projectClassification.complexity}
          </p>
        </ResultCard>

        <ResultCard title="Risk Level">
          <p className="text-2xl font-semibold capitalize text-white">
            {result.enrichment.projectClassification.riskLevel}
          </p>
        </ResultCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ResultCard title="Email Notification">
          <div className="mb-4">
            <StatusBadge status={result.systems.email.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Provider:</span>{" "}
              {result.systems.email.provider}
            </p>
            <p>
              <span className="text-zinc-500">Recipients:</span>{" "}
              {result.systems.email.recipients.length}
            </p>
            <p>
              <span className="text-zinc-500">Subject:</span>{" "}
              {result.systems.email.subject}
            </p>
            <div className="pt-1">
              <p className="text-zinc-500">To / CC:</p>
              <ul className="mt-2 space-y-2">
                {result.systems.email.recipients.map((recipient) => (
                  <li
                    key={recipient.address}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <p className="text-zinc-100">{recipient.name}</p>
                    <p className="text-xs text-zinc-500">
                      {recipient.role} - {recipient.address}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-1">
              <p className="text-zinc-500">Outlook payload</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                {JSON.stringify(result.systems.email.payload, null, 2)}
              </pre>
            </div>
            <p className="pt-2 text-zinc-400">{result.systems.email.message}</p>
          </div>
        </ResultCard>

        <ResultCard title="SharePoint">
          <div className="mb-4">
            <StatusBadge status={result.systems.sharepoint.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Action:</span>{" "}
              {result.systems.sharepoint.action}
            </p>
            <p>
              <span className="text-zinc-500">From:</span>{" "}
              {result.systems.sharepoint.sourceFolder}
            </p>
            <p>
              <span className="text-zinc-500">To:</span>{" "}
              {result.systems.sharepoint.destinationFolder}
            </p>
            <p className="pt-2 text-zinc-400">
              {result.systems.sharepoint.message}
            </p>
          </div>
        </ResultCard>

        <ResultCard title="ClickUp">
          <div className="mb-4">
            <StatusBadge status={result.systems.clickup.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Project:</span>{" "}
              {result.systems.clickup.projectName}
            </p>
            <p>
              <span className="text-zinc-500">Space:</span>{" "}
              {result.systems.clickup.space}
            </p>
            <p>
              <span className="text-zinc-500">Folder:</span>{" "}
              {result.systems.clickup.folder}
            </p>
            <p className="pt-2 text-zinc-400">
              {result.systems.clickup.message}
            </p>
          </div>
        </ResultCard>

        <ResultCard title="Teams">
          <div className="mb-4">
            <StatusBadge status={result.systems.teams.status} />
          </div>

          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Team:</span>{" "}
              {result.systems.teams.teamName}
            </p>
            <p>
              <span className="text-zinc-500">Channel:</span>{" "}
              {result.systems.teams.channelName}
            </p>
            <p className="pt-2 text-zinc-400">{result.systems.teams.message}</p>
          </div>
        </ResultCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ResultCard title="Kickoff Email">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Subject
              </p>
              <p className="mt-1 text-sm text-zinc-200">
                {result.enrichment.kickoffEmail.subject}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Body
              </p>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                {result.enrichment.kickoffEmail.body}
              </pre>
            </div>
          </div>
        </ResultCard>

        <ResultCard title="Teams Intro Message">
          <pre className="whitespace-pre-wrap text-sm text-zinc-300">
            {result.enrichment.teamsIntroMessage}
          </pre>
        </ResultCard>
      </div>

      <ResultCard title="Suggested ClickUp Tasks">
        <div className="space-y-4">
          {result.enrichment.clickupTasks.map((task, index) => (
            <div
              key={`${task.title}-${index}`}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-white">{task.title}</p>
                <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs capitalize text-zinc-300">
                  {task.priority}
                </span>
              </div>

              <p className="mt-2 text-sm text-zinc-400">{task.description}</p>
              <p className="mt-3 text-xs text-zinc-500">
                Owner: <span className="text-zinc-300">{task.owner}</span>
              </p>
            </div>
          ))}
        </div>
      </ResultCard>
    </section>
  );
}
