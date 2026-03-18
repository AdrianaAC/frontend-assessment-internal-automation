type Props = {
  status: string;
};

const statusStyles: Record<string, string> = {
  success:
    "border-emerald-400/30 bg-emerald-400/12 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  error:
    "border-rose-400/30 bg-rose-400/12 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  warning:
    "border-amber-300/30 bg-amber-300/12 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  pending:
    "border-cyan-300/30 bg-cyan-300/12 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
};

// Shows a consistently styled status label for workflow steps and systems.
export default function StatusBadge({ status }: Props) {
  const normalizedStatus = status.trim().toLowerCase();
  const statusClassName =
    statusStyles[normalizedStatus] ??
    "border-zinc-700 bg-zinc-800 text-zinc-300";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] ${statusClassName}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {normalizedStatus}
    </span>
  );
}
