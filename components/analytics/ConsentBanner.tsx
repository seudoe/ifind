"use client";

import { Button } from "@/components/ui/Button";
import { clearGaCookies, writeConsent } from "@/lib/analytics/consent";

interface ConsentBannerProps {
  onChoose: (choice: "granted" | "denied") => void;
}

export function ConsentBanner({ onChoose }: ConsentBannerProps) {
  const choose = (choice: "granted" | "denied") => {
    try {
      writeConsent(choice, localStorage);
    } catch {
      // localStorage inaccessible: the choice applies for this visit only.
    }
    // A declined visitor must not keep a `_ga` cookie: server events treat that cookie as consent.
    if (choice === "denied") clearGaCookies(process.env.NEXT_PUBLIC_GA_ID, document, location.hostname);
    onChoose(choice);
  };

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text)]">
          We use Google Analytics to understand how iFind is used and to improve it. Analytics cookies are only set if
          you accept.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => choose("denied")}>
            Decline
          </Button>
          <Button variant="primary" size="sm" onClick={() => choose("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
