"use client";

import { useEffect, useState } from "react";
import type { AucklandEventsResult, KiwiCueEvent } from "../../lib/events";

type ExplorerState =
  | { status: "loading"; events: [] }
  | { status: "ready"; events: KiwiCueEvent[] }
  | { status: "empty"; events: [] }
  | { status: "error"; events: [] };

async function requestEventsFromApi(): Promise<AucklandEventsResult> {
  const response = await fetch("/api/events?size=24", {
    headers: { accept: "application/json" },
  });
  const body = await response.json() as AucklandEventsResult | { error?: { message?: string } };

  if (!response.ok || !("events" in body) || !Array.isArray(body.events)) {
    throw new Error("Event feed unavailable");
  }

  return body;
}

function formatEventDate(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatEventTime(localTime: string | null): string {
  if (!localTime) return "Time to be confirmed";
  const [hour, minute] = localTime.split(":").map(Number);
  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, hour, minute))).toLowerCase();
}

export function EventExplorer({
  requestEvents = requestEventsFromApi,
}: {
  requestEvents?: () => Promise<AucklandEventsResult>;
}) {
  const [state, setState] = useState<ExplorerState>({ status: "loading", events: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    requestEvents()
      .then((result) => {
        if (cancelled) return;
        setState(result.events.length
          ? { status: "ready", events: result.events }
          : { status: "empty", events: [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", events: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, requestEvents]);

  function retry() {
    setState({ status: "loading", events: [] });
    setAttempt((currentAttempt) => currentAttempt + 1);
  }

  if (state.status === "loading") {
    return (
      <section className="event-state event-loading" role="status" aria-busy="true">
        <span className="loading-pulse" aria-hidden="true" />
        <p>Scanning Auckland for what is next</p>
        <div className="event-skeletons" aria-hidden="true">
          <i /><i /><i />
        </div>
      </section>
    );
  }

  if (state.status === "ready") {
    return (
      <section className="event-feed" aria-live="polite">
        <div className="event-feed-toolbar">
          <p>{state.events.length} {state.events.length === 1 ? "event" : "events"} found · Soonest first</p>
          <span><i aria-hidden="true" /> Official source links included</span>
        </div>
        <ol className="event-list">
          {state.events.map((event, index) => (
            <li key={event.id}>
              <article className="event-card">
                <div className="event-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                <div className="event-date-block">
                  <time dateTime={event.start.localDate}>{formatEventDate(event.start.localDate)}</time>
                  <span>{formatEventTime(event.start.localTime)}</span>
                </div>
                <div className="event-card-copy">
                  <div className="event-labels">
                    <span>{event.category}</span>
                    {event.status !== "onsale" && <span>{event.status.replaceAll("_", " ")}</span>}
                  </div>
                  <h3>{event.name}</h3>
                  <p className="event-venue">
                    {event.venue ? `${event.venue.name} · ${event.venue.city}` : "Auckland venue to be confirmed"}
                  </p>
                  {event.venue?.address && <p className="event-address">{event.venue.address}</p>}
                  <a
                    className="event-source-link"
                    href={event.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`View ${event.name} on Ticketmaster`}
                  >
                    Official details <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <div
                  className={`event-art${event.imageUrl ? " has-image" : ""}`}
                  style={event.imageUrl
                    ? { backgroundImage: `linear-gradient(135deg, transparent, rgba(8, 10, 8, .55)), url(${JSON.stringify(event.imageUrl)})` }
                    : undefined}
                  aria-hidden="true"
                >
                  {!event.imageUrl && <span>AKL</span>}
                </div>
              </article>
            </li>
          ))}
        </ol>
        <p className="source-disclaimer">
          Event details and ticket availability come from Ticketmaster. KiwiCue helps you discover events and does not sell tickets.
        </p>
      </section>
    );
  }

  if (state.status === "empty") {
    return (
      <section className="event-state event-empty" aria-live="polite">
        <span className="state-code" aria-hidden="true">AKL / 00</span>
        <h2>Nothing on our radar yet</h2>
        <p>Try again soon—new Auckland events are added throughout the week.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="event-state event-error" role="alert">
        <span className="state-code" aria-hidden="true">SIGNAL LOST</span>
        <h2>Auckland events are temporarily out of range</h2>
        <p>We could not refresh the event feed. Your Ticketmaster key and technical details remain private.</p>
        <button type="button" onClick={retry} aria-label="Retry event scan">
          Scan again <span aria-hidden="true">↻</span>
        </button>
      </section>
    );
  }

  return null;
}
