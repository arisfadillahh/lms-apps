"use client";

export type MetaEventParameters = {
  program_name?: string;
  program_id?: string;
  form_type?: string;
  level?: string;
  package_type?: string;
  value?: number;
  currency?: string;
};

type MetaEventOptions = {
  eventId?: string;
};

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: MetaPixelFunction;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
    __clevioMetaPixelInitialized?: boolean;
  }
}

const META_PIXEL_SCRIPT_ID = "clevio-meta-pixel";

export function isMetaPixelEnabled() {
  return process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

export function initializeMetaPixel() {
  if (!isMetaPixelEnabled() || typeof window === "undefined" || typeof document === "undefined") return false;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return false;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as MetaPixelFunction;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
  }

  if (!document.getElementById(META_PIXEL_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = META_PIXEL_SCRIPT_ID;
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  if (!window.__clevioMetaPixelInitialized) {
    window.fbq("init", pixelId);
    window.__clevioMetaPixelInitialized = true;
  }

  return true;
}

export function trackPageView(parameters: MetaEventParameters = {}) {
  trackStandardEvent("PageView", parameters);
}

export function trackViewContent(parameters: MetaEventParameters = {}, options?: MetaEventOptions) {
  trackStandardEvent("ViewContent", parameters, options);
}

export function trackLead(parameters: MetaEventParameters = {}, options?: MetaEventOptions) {
  trackStandardEvent("Lead", parameters, options);
}

function trackStandardEvent(eventName: string, parameters: MetaEventParameters = {}, options?: MetaEventOptions) {
  if (!initializeMetaPixel() || !window.fbq) return;
  const compacted = compactParameters(parameters);
  if (options?.eventId) window.fbq("track", eventName, compacted, { eventID: options.eventId });
  else window.fbq("track", eventName, compacted);
}

function compactParameters(parameters: MetaEventParameters) {
  return Object.fromEntries(Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}
