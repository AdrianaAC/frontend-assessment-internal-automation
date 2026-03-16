type Props = {
  status: string;
};

const statusStyles: Record<string, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  pending: "border-sky-500/30 bg-sky-500/10 text-sky-300",
};

export default function StatusBadge({ status }: Props) {
  const normalizedStatus = status.trim().toLowerCase();
  const statusClassName =
    statusStyles[normalizedStatus] ??
    "border-zinc-700 bg-zinc-800 text-zinc-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClassName}`}
    >
      {normalizedStatus}
    </span>
  );
}
