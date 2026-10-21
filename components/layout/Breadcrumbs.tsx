import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/lib/site";

export interface Crumb {
  label: string;
  /** Omit on the current page. */
  href?: string;
}

/** Visible breadcrumb trail plus the matching BreadcrumbList JSON-LD (so markup and page content always agree). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ label: "Home", href: "/user" }, ...items];

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--text-2)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {i === 0 && <Home className="h-3.5 w-3.5" aria-hidden />}
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="hover:text-[var(--primary)] hover:underline underline-offset-2">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-[var(--text)]" : undefined}>
                    {crumb.label}
                  </span>
                )}
                {!last && <ChevronRight className="h-3.5 w-3.5 text-[var(--text-3)]" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((crumb, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: crumb.label,
            ...(crumb.href ? { item: `${SITE_URL}${crumb.href}` } : {}),
          })),
        }}
      />
    </>
  );
}
