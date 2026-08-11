import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MovieDetailContent } from "../../../components/movie-detail-content";
import { parseMovieId } from "../../../lib/movie-previews";

export const metadata: Metadata = {
  title: "Movie preview | KiwiCue",
  description: "Read a movie synopsis, watch its trailer, and check official Auckland cinema sessions.",
};

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ movieId: string }>;
}) {
  const { movieId } = await params;
  const parsedMovieId = parseMovieId(movieId);
  if (!parsedMovieId) notFound();
  return <MovieDetailContent movieId={String(parsedMovieId)} />;
}
