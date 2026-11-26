"use client";

import { useEffect, useState } from "react";

export interface DeviceSignals {
  userAgent?: string;
  innerWidth?: number;
  innerHeight?: number;
  screenWidth?: number;
  screenHeight?: number;
  maxTouchPoints?: number;
  coarsePointer?: boolean;
}

const PHONE_UA_PATTERN = /iphone|ipod|windows phone|blackberry|bb10|opera mini|iemobile|mobile safari/i;

/**
 * Determines whether the current client is a handheld mobile phone.
 * Allows laptops, desktops, iPads, and larger tablets (>= 768px), while
 * blocking phones even if rotated into landscape or using "Request Desktop Site".
 */
export function isMobilePhoneDevice(overrides?: DeviceSignals): boolean {
  if (typeof window === "undefined" && !overrides) return false;

  const ua = overrides?.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent || "" : "");
  const isIpad = /ipad/i.test(ua);
  const isPhoneUa = !isIpad && (PHONE_UA_PATTERN.test(ua) || (/android/i.test(ua) && /mobile/i.test(ua)));
  if (isPhoneUa) return true;

  const width = overrides?.innerWidth ?? (typeof window !== "undefined" ? window.innerWidth : 0);
  const height = overrides?.innerHeight ?? (typeof window !== "undefined" ? window.innerHeight : 0);
  if (width > 0 && width < 768) return true;

  const screenW = overrides?.screenWidth ?? (typeof window !== "undefined" ? window.screen?.width ?? 0 : 0);
  const screenH = overrides?.screenHeight ?? (typeof window !== "undefined" ? window.screen?.height ?? 0 : 0);
  const minScreen = screenW > 0 && screenH > 0 ? Math.min(screenW, screenH) : 0;
  const maxTouch = overrides?.maxTouchPoints ?? (typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0);
  const coarse =
    overrides?.coarsePointer ??
    (typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false);

  // Handheld phone rotated to landscape (e.g., 844x390) or using Request Desktop Site
  if (!isIpad && minScreen > 0 && minScreen < 520 && (maxTouch > 0 || coarse)) {
    return true;
  }
  if (!isIpad && width > 0 && height > 0 && Math.min(width, height) < 520 && (maxTouch > 0 || coarse)) {
    return true;
  }

  return false;
}

/** React hook that detects mobile phone viewports/devices safely without hydration mismatches. */
export function useMobilePhoneGuard(): { checked: boolean; isMobilePhone: boolean } {
  const [state, setState] = useState<{ checked: boolean; isMobilePhone: boolean }>({
    checked: false,
    isMobilePhone: false,
  });

  useEffect(() => {
    const update = () => {
      setState({ checked: true, isMobilePhone: isMobilePhoneDevice() });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}
