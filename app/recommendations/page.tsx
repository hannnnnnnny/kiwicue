import { permanentRedirect } from "next/navigation";

// Picks and For You are one page now; old links and bookmarks land there.
export default function RecommendationsPage() {
  permanentRedirect("/for-you");
}
