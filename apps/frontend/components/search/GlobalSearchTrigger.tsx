"use client";

import { Command, Search } from "lucide-react";

interface GlobalSearchTriggerProps {
  onOpen: () => void;
}

export function GlobalSearchTrigger({ onOpen }: GlobalSearchTriggerProps) {
  return (
    <button
      className="portal-search"
      onClick={onOpen}
      type="button"
      aria-label="Global search"
    >
      <Search size={15} />
      <span>Search resources, accounts, findings...</span>
      <kbd>
        <Command size={11} />K
      </kbd>
    </button>
  );
}
