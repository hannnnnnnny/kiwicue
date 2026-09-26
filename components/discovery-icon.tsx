export function DiscoveryIcon({ name }: { name: "moon" | "pin" | "tag" | "people" | "heart" | "dice" | "search" | "map" | "film" | "share" | "star" | "calendar" | "spark" }) {
  const paths = {
    moon: "M20 14A8 8 0 0 1 10 4 8 8 0 1 0 20 14Z",
    pin: "M12 21s7-7 7-12A7 7 0 0 0 5 9c0 5 7 12 7 12ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    tag: "M3 3h8l10 10-8 8L3 11V3Zm4 4h.01",
    people: "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM18 4a4 4 0 0 1 0 8m1 3a4 4 0 0 1 3 4v2",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    dice: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01",
    search: "M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z",
    map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
    film: "M3 3h18v18H3V3Zm4 0v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4",
    share: "M12 16V3m-4 4 4-4 4 4M7 11H4v10h16V11h-3",
    calendar: "M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4",
    spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8M6.3 17.7l2.8-2.8m5.8-5.8 2.8-2.8",
    star: "m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8L2.2 9.2l6.8-1L12 2Z",
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
