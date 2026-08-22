"use client";

import Image from "next/image";
import { useState } from "react";

export function CinemaBrandMark({ asset, label, cinemaId }: {
  asset: string | null;
  label: string;
  cinemaId: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="cinema-brand-mark" data-testid={`cinema-brand-${cinemaId}`} aria-hidden="true">
      {asset && !failed ? (
        <Image src={asset} alt="" width={96} height={96} onError={() => setFailed(true)} />
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}
