export type MovieDateFilter = "today" | "tomorrow" | "weekend" | "all";

export type KiwiCueScreening = {
  id: string;
  filmId: string;
  filmTitle: string;
  filmRating: string | null;
  runtimeMinutes: number | null;
  cinemaId: string;
  cinemaName: string;
  startTime: string;
  formats: string[];
  soldOut: boolean;
  distanceKilometres: number | null;
  bookingUrl: string | null;
};
