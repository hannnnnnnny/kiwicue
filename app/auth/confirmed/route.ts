import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const confirmed = Boolean(code && code.length <= 2048 && !url.searchParams.has("error"));
  const destination = new URL("/auth/verified", url.origin);
  destination.searchParams.set("status", confirmed ? "confirmed" : "unknown");
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
