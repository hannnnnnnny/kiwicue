import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DistancePanel } from "../components/distance-panel";

const venue = { latitude: -36.8485, longitude: 174.7633 };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function position(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

function geoError(code: number): GeolocationPositionError {
  return { code, message: "private browser message", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
}

describe("distance panel", () => {
  it("does not request location before an explicit activation", () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    render(<DistancePanel coordinates={venue} language="en" />);

    expect(screen.getByRole("button", { name: "Show distance from me" })).toBeEnabled();
    expect(screen.getByText("Your position is used only on this device and is not saved.")).toBeVisible();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("calculates and announces distance locally after permission succeeds", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success(position(-36.8445, 174.7680));
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    render(<DistancePanel coordinates={venue} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Show distance from me" }));

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
    expect(screen.getByRole("status")).toHaveTextContent(/About 0\.[56] km away \(straight line\)/);
  });

  it.each([
    [1, "Location access is off. Enable it in your browser settings to calculate distance."],
    [2, "Your location is unavailable right now."],
    [3, "Location took too long. Try again."],
  ])("maps geolocation error %i to useful copy", (code, message) => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => {
      failure(geoError(code));
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    render(<DistancePanel coordinates={venue} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Show distance from me" }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Try location again" })).toBeEnabled();
    expect(screen.queryByText("private browser message")).not.toBeInTheDocument();
  });

  it("handles browsers without geolocation", () => {
    vi.stubGlobal("navigator", {});

    render(<DistancePanel coordinates={venue} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Show distance from me" }));

    expect(screen.getByRole("alert")).toHaveTextContent("This browser cannot provide location distance.");
  });

  it("renders equivalent Chinese controls and privacy copy", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success(position(-36.8445, 174.7680));
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    render(<DistancePanel coordinates={venue} language="zh" />);
    fireEvent.click(screen.getByRole("button", { name: "查看离我多远" }));

    expect(screen.getByRole("status")).toHaveTextContent(/约 0\.[56] 公里（直线距离）/);
    expect(screen.getByText("你的位置只在当前设备计算，不会被保存。")).toBeVisible();
  });
});
