"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/authRedirect";

function WithNext(props: React.ComponentProps<typeof Link>) {
  const next = safeNextPath(useSearchParams().get("next"));
  const href = next && typeof props.href === "string" ? `${props.href}?next=${encodeURIComponent(next)}` : props.href;
  return <Link {...props} href={href} />;
}

/** A Link that carries the current ?next= along, so login <-> register keeps the visitor's destination. */
export function NextLink(props: React.ComponentProps<typeof Link>) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <WithNext {...props} />
    </Suspense>
  );
}
