import React from "react";
import { AccountDetailView } from "../../route-views";

export default function AccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = React.use(params);
  return <AccountDetailView accountId={accountId} />;
}
