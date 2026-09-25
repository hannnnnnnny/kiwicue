"use client";

import { useState } from "react";
import { ChipField } from "../../../components/chip-field";
import { filterKey, type ActiveChip, type ChipOption } from "../../../lib/chip-field";

const OPTIONS: ChipOption[] = [
  { id: "music", label: "Live music" },
  { id: "free", label: "Free" },
  { id: "tonight", label: "Tonight" },
  { id: "outdoor", label: "Outdoor" },
  { id: "family", label: "Family friendly" },
  { id: "food", label: "Food & drink" },
  { id: "theatre", label: "Theatre" },
  { id: "markets", label: "Night markets" },
  { id: "accessible", label: "Step-free access" },
];

const INITIAL: ActiveChip[] = [
  { key: filterKey("tonight"), label: "Tonight", kind: "filter" },
  { key: "custom:ponsonby", label: "Ponsonby", kind: "custom" },
];

export function FilterChipsDemo() {
  const [value, setValue] = useState<readonly ActiveChip[]>(INITIAL);
  return (
    <main className="chipfield-lab">
      <div className="chipfield-lab__glow" aria-hidden="true"><span /><span /><span /></div>
      <div className="chipfield-lab__intro">
        <p className="chipfield-lab__eyebrow">Component lab</p>
        <h1>Filter &amp; tag chips</h1>
        <p>Pick presets, type your own tags, and remove anything with ×. Every chip moves with the layout.</p>
      </div>
      <ChipField title="Find something to do" options={OPTIONS} value={value} onChange={setValue} />
    </main>
  );
}
