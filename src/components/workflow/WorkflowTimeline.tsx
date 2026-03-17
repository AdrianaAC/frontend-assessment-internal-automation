import StatusBadge from "@/components/workflow/StatusBadge";
import type { WorkflowExecutionStep } from "@/types/workflow";

type Props = {
  steps: WorkflowExecutionStep[];
};

const markerStyles: Record<string, string> = {
  success: "bg-emerald-400",
  error: "bg-rose-400",
  warning: "bg-amber-400",
  pending: "bg-sky-400",
};

export default function WorkflowTimeline({ steps }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Workflow Timeline</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Execution trace for the automation run.
          </p>
        </div>
        <span className="text-sm text-zinc-500">{steps.length} steps</span>
      </div>

      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li
            key={`${step.title}-${index}`}
            className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-3 w-3 rounded-full ${
                  markerStyles[step.status] ?? "bg-zinc-500"
                }`}
              />
              {index < steps.length - 1 ? (
                <span className="mt-2 h-full w-px bg-zinc-800" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-medium text-white">{step.title}</h3>
                <StatusBadge status={step.status} />
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {step.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{step.durationMs} ms</span>
                <span>{step.attempts} attempt(s)</span>
                <span>{step.retryable ? "retryable" : "not retryable"}</span>
                <span>
                  {step.approvalRequired
                    ? "approval required"
                    : "no approval required"}
                </span>
                <span>
                  {step.continuedAfterFailure
                    ? "workflow can continue after failure"
                    : "workflow stops on failure"}
                </span>
                {step.errorMessage ? <span>Error: {step.errorMessage}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
