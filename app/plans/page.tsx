import type { Metadata } from "next";
import { OutingPlansPage } from "../../components/ask/outing-plans-page";

export const metadata: Metadata = { title: "My outing plans — KiwiCue", robots: { index: false, follow: false } };

export default function PlansPage() { return <OutingPlansPage />; }
