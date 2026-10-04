import type { Metadata } from "next";
import { RecommendationsPageContent } from "../../components/recommendations-page-content";

export const metadata: Metadata = {
  title: "For You — KiwiCue",
  description: "A short, explained list of upcoming Auckland events and markets, plus picks from the interests you choose.",
};

export default function ForYouPage() {
  return <RecommendationsPageContent />;
}
