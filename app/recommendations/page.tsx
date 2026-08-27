import type { Metadata } from "next";
import { RecommendationsPageContent } from "../../components/recommendations-page-content";

export const metadata: Metadata = {
  title: "Auckland event picks — KiwiCue",
  description: "A smaller, explainable shortlist of upcoming Auckland events and markets.",
};

export default function RecommendationsPage() {
  return <RecommendationsPageContent />;
}
