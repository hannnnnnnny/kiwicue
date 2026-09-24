import { CollectionDetailContent } from "../../../components/collection-detail-content";
import { PortalHeader } from "../../../components/portal-header";

export const dynamic = "force-dynamic";
export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="account-page"><PortalHeader /><CollectionDetailContent id={id} /></main>;
}
