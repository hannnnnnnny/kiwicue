import { CollectionsPageContent } from "../../components/collections-page-content";
import { MineTabs } from "../../components/mine-tabs";
import { PortalHeader } from "../../components/portal-header";
export const dynamic = "force-dynamic";
export default function CollectionsPage() { return <main className="account-page"><PortalHeader currentPage="mine" skipTarget="main-content" /><MineTabs current="collections" /><div id="main-content"><CollectionsPageContent /></div></main>; }
