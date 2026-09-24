import { NotificationsPageContent } from "../../components/notifications-page-content";
import { PortalHeader } from "../../components/portal-header";

export const dynamic = "force-dynamic";
export default function NotificationsPage() { return <main className="account-page"><PortalHeader /><NotificationsPageContent /></main>; }
