"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { trackLead, trackPageView, trackViewContent } from "@/lib/metaPixel";

const parameters = {
  program_name: "Holiday Class Clevio 2026",
  program_id: "holiday-class-2026",
  form_type: "landing",
  currency: "IDR"
};

export default function HolidayClassPixel() {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackPageView(parameters);
    trackViewContent(parameters, { eventId: "view-content:holiday-class-2026-landing" });
  }, []);

  return null;
}

type HolidayClassLeadLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export function HolidayClassLeadLink({ href, className, children, ariaLabel }: HolidayClassLeadLinkProps) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      onClick={() => trackLead(parameters)}
    >
      {children}
    </a>
  );
}
