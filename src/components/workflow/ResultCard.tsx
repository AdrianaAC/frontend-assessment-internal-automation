import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export default function ResultCard({ title, children, className = "" }: Props) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-6 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}