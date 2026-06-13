"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn";

const UNSAFE_ERROR_CONTENT = /(access[_-]?key|secret|credential|authorization|bearer|stack|at\s+\S+\s*\()/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeSafeErrorMessage(message?: string): string {
  const firstLine = message?.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine || UNSAFE_ERROR_CONTENT.test(firstLine)) {
    return "The request could not be completed. Try again or contact support with the reference ID.";
  }
  return firstLine.slice(0, 240);
}

export function normalizeCorrelationId(value?: string): string | null {
  if (!value || value.length > 36) return null;
  if (!UUID_PATTERN.test(value)) return null;
  if (UNSAFE_ERROR_CONTENT.test(value)) return null;
  return value;
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  correlationId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title = "Data unavailable", message, correlationId, onRetry, retryLabel = "Try again", action, className }: ErrorStateProps) {
  const [copied, setCopied] = useState(false);
  const safeCorrelationId = normalizeCorrelationId(correlationId);

  async function copyReference() {
    if (!safeCorrelationId) return;
    try {
      await navigator.clipboard.writeText(safeCorrelationId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={cn("ds-state ds-state--error", className)} role="alert">
      <AlertTriangle className="ds-state__icon" aria-hidden="true" size={20} />
      <h2>{title}</h2>
      <p>{normalizeSafeErrorMessage(message)}</p>
      {safeCorrelationId ? (
        <div className="ds-error-reference">
          <span>Reference: <code>{safeCorrelationId}</code></span>
          <button type="button" onClick={copyReference} aria-label="Copy error reference ID">
            {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
          </button>
          <span className="sr-only" aria-live="polite">{copied ? "Reference ID copied" : ""}</span>
        </div>
      ) : null}
      {(onRetry || action) ? (
        <div className="ds-state__action">
          {onRetry ? <button className="ds-button" type="button" onClick={onRetry}><RefreshCw aria-hidden="true" size={14} />{retryLabel}</button> : null}
          {action}
        </div>
      ) : null}
    </section>
  );
}
