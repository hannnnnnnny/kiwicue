import type { Language } from "../components/language-provider";
import type { EventCoordinates } from "./events";

const EARTH_RADIUS_KM = 6371;

export function isValidCoordinates(
  coordinates: EventCoordinates,
): boolean {
  return Number.isFinite(coordinates.latitude) &&
    coordinates.latitude >= -90 && coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.longitude >= -180 && coordinates.longitude <= 180;
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function distanceKm(
  from: EventCoordinates,
  to: EventCoordinates,
): number {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) {
    throw new RangeError("Invalid coordinates");
  }

  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) *
    Math.sin(longitudeDelta / 2) ** 2;
  const centralAngle = 2 * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(Math.max(0, 1 - haversine)),
  );
  return EARTH_RADIUS_KM * centralAngle;
}

export function formatDistanceKm(distance: number, language: Language): string {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError("Invalid distance");
  }
  const value = distance < 10 ? distance.toFixed(1) : String(Math.round(distance));
  return language === "zh"
    ? `约 ${value} 公里（直线距离）`
    : `About ${value} km away (straight line)`;
}
