import type { Metadata } from "next";
import { FilterChipsDemo } from "./filter-chips-demo";

export const metadata: Metadata = {
  title: "Filter chips — KiwiCue lab",
  robots: { index: false, follow: false },
};

export default function FilterChipsLabPage() {
  return <FilterChipsDemo />;
}
