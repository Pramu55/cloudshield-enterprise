import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export interface LoadingStateProps {
  message?: string;
  skeleton?: boolean;
  className?: string;
}

export function LoadingState({ message = "Loading data...", skeleton = false, className }: LoadingStateProps) {
  return (
    <div className={cn("ds-state", className)} aria-busy="true" aria-live="polite">
      <Loader2 className="ds-state__spinner" aria-hidden="true" size={18} />
      <span>{message}</span>
      {skeleton ? <span className="ds-state__skeleton" aria-hidden="true" /> : null}
    </div>
  );
}
