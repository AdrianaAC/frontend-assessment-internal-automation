import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

// Wraps a section of workflow output in the shared card styling.
export default function ResultCard({ title, children, className = "" }: Props) {
  return (
    <div
      className={`glass-panel rounded-[1.75rem] p-6 sm:p-7 ${className}`}
    >
      <h3 className="mb-4 text-lg font-semibold tracking-[-0.02em] text-white">
        {title}
      </h3>
      {children}
    </div>
  );
}
