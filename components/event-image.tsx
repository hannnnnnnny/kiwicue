"use client";

import { useState } from "react";

type EventImageProps = {
  src: string | null;
  alt: string;
  fallback: string;
  loading?: "eager" | "lazy";
};

export function EventImage({
  src,
  alt,
  fallback,
  loading = "lazy",
}: EventImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const unavailable = !src || failedSrc === src;

  if (unavailable) {
    return <span className="portal-event-fallback" aria-hidden="true">{fallback}</span>;
  }

  return (
    // Ticketmaster image hosts vary; upstream normalization limits the accepted URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}
