import type { Metadata } from "next";
import { SavedPageContent } from "../../components/saved-page-content";

export const metadata: Metadata = {
  title: "Saved Auckland events — KiwiCue",
  description: "Review Auckland events saved locally in your browser.",
};

export default function SavedPage() {
  return <SavedPageContent />;
}
