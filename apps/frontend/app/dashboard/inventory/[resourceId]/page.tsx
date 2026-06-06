import React from "react";
import { ResourceDetailView } from "../../route-views";

export default function ResourceDetailPage({ params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = React.use(params);
  return <ResourceDetailView resourceId={resourceId} />;
}
