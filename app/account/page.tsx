import { AccountSettings } from "../../components/account-settings";
import { PortalHeader } from "../../components/portal-header";

export const dynamic = "force-dynamic";
export default function AccountPage() {
  return <main className="account-page"><PortalHeader /><AccountSettings /></main>;
}
