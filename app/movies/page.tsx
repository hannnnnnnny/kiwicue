import type { Metadata } from "next";
import { MoviesPageContent } from "../../components/movies-page-content";
import { parseMovieDateFilter, parseMovieQuery } from "../../lib/movie-search-params";

export const metadata: Metadata = {
  title: "Auckland movies — KiwiCue",
  description: "Find Auckland movie sessions and open official cinema listings without a paid subscription.",
};

type MoviesPageProps = {
  searchParams?: Promise<{ q?: string | string[]; date?: string | string[] }>;
};

export default async function MoviesPage({ searchParams = Promise.resolve({}) }: MoviesPageProps = {}) {
  const params = await searchParams;
  return (
    <MoviesPageContent
      initialQuery={parseMovieQuery(params.q)}
      initialDate={parseMovieDateFilter(params.date)}
    />
  );
}
