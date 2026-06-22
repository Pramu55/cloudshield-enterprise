import React from "react";
import { FindingDetail } from "./finding-detail";

export default function SecurityFindingDetailPage({
  params
}: {
  params: Promise<{ findingId: string }>;
}) {
  const { findingId } = React.use(params);
  return <FindingDetail findingId={findingId} />;
}
