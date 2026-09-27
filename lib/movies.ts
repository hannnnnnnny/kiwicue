export type MovieDateFilter = "today" | "tomorrow" | "weekend" | "all";
export type CinemaChain = "HOYTS" | "EVENT Cinemas";

/** Public ticket prices for one session, in NZD cents. Member-only and complimentary tickets are excluded. */
export type ScreeningPrice = {
  minCents: number;
  maxCents: number;
  bookingFeeCents: number | null;
};

export type KiwiCueScreening = {
  id: string;
  filmId: string;
  filmTitle: string;
  filmRating: string | null;
  runtimeMinutes: number | null;
  cinemaId: string;
  cinemaName: string;
  chain: CinemaChain;
  startTime: string;
  screenType: string;
  formats: string[];
  soldOut: boolean;
  discounted: boolean;
  bookingUrl: string | null;
  price: ScreeningPrice | null;
};

/** One film across every covered Auckland cinema for the requested dates. */
export type MovieShowing = {
  id: string;
  title: string;
  rating: string | null;
  runtimeMinutes: number | null;
  cinemaCount: number;
  sessionCount: number;
  nextStartTime: string;
  nextCinemaName: string;
  screenTypes: string[];
};

export const CINEMA_CHAINS: readonly CinemaChain[] = ["HOYTS", "EVENT Cinemas"];
