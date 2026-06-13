"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../../lib/cn";

export interface ResourceIdProps {
  value: string;
  maxLength?: number;
  mask?: (value: string) => string;
  copyValue?: string;
  className?: string;
}

export function truncateResourceId(value: string, maxLength = 28): string {
  if (value.length <= maxLength) return value;
  const visibleLength = Math.max(8, maxLength - 3);
  const start = Math.ceil(visibleLength / 2);
  const end = Math.floor(visibleLength / 2);
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function ResourceId({ value, maxLength = 28, mask, copyValue, className }: ResourceIdProps) {
  const [copied, setCopied] = useState(false);
  const visibleValue = mask ? mask(value) : value;
  const clipboardValue = copyValue ?? visibleValue;
  const copyDescription = mask
    ? copyValue === value
      ? "complete resource identifier"
      : "masked resource identifier"
    : "complete resource identifier";

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(clipboardValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className={cn("ds-resource-id", className)} title={visibleValue}>
      <code aria-label={`Resource identifier: ${visibleValue}`}>{truncateResourceId(visibleValue, maxLength)}</code>
      <button type="button" onClick={copyToClipboard} aria-label={`Copy ${copyDescription}`}>
        {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? "Resource identifier copied" : ""}</span>
    </span>
  );
}
