import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/cn";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <section className={cn("ds-state ds-state--empty", className)} aria-label={title}>
      <span className="ds-state__icon" aria-hidden="true">{icon ?? <Inbox size={20} />}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="ds-state__action">{action}</div> : null}
    </section>
  );
}
