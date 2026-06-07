import React from "react";
import { ScanDetailView } from "../../route-views";

export default function ScanDetailPage({ params }: { params: Promise<{ scanRunId: string }> }) {
  const { scanRunId } = React.use(params);
  return <ScanDetailView scanRunId={scanRunId} />;
}
