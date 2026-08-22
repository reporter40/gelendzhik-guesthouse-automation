"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  scrollToAuditLogAnchor,
  shouldScrollToAuditLogFromSearchParams,
} from "@/lib/audit-log-summary";

/** D2.8 — mount when audit table is hidden (empty log) but deep-link still applies. */
export function AuditDeepLinkScroll() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!shouldScrollToAuditLogFromSearchParams(searchParams)) return;

    const frame = requestAnimationFrame(() => {
      scrollToAuditLogAnchor();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
