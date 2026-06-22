import type { FrontendInventorySyncResponse } from "./response-contracts";

export type InventorySyncFeedback = {
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
};

export function inventorySyncFeedback(result: FrontendInventorySyncResponse): InventorySyncFeedback {
  const item = result.items[0];
  if (!item) {
    return { tone: "danger", title: "Inventory scan response invalid", message: "The inventory scan response was incomplete." };
  }
  if (item.status === "QUEUED") {
    return {
      tone: "info",
      title: "Inventory scan queued",
      message: "The inventory scan request was queued for asynchronous processing. Completion is not confirmed yet."
    };
  }
  if (item.status === "DUPLICATE_ACTIVE") {
    return {
      tone: "warning",
      title: "Inventory scan already active",
      message: `An active scan already covers this account and region set. Another scan was not queued. Scan reference: ${item.scanRunId}.`
    };
  }
  if (item.status === "BLOCKED") {
    return { tone: "warning", title: "Inventory scan blocked", message: item.blockedReason };
  }
  if (item.status === "CONFLICT") {
    return { tone: "danger", title: "Inventory scan conflict", message: item.message };
  }
  return {
    tone: "warning",
    title: "Inventory scan planned",
    message: "The inventory scan was planned, but no scan was queued."
  };
}
