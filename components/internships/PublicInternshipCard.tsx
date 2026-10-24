import Link from "next/link";
import { Clock, MapPin, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CompanyLogo } from "@/components/internships/CompanyLogo";
import { StipendBadge } from "@/components/internships/StipendBadge";
import { formatAddresses } from "@/lib/address";
import { sourceLabel } from "@/lib/constants";
import { internshipSlug } from "@/lib/slug";
import { formatDuration } from "@/lib/utils";
import type { Internship } from "@/types";

/** Card for the public pages: the whole card is a link to /internships/<slug>, no login needed to look. */
export function PublicInternshipCard({ internship }: { internship: Internship }) {
  const location = internship.isRemote
    ? "Work from Home"
    : formatAddresses(internship.address, ["city", "state"]) || formatAddresses(internship.address, ["country"]) || "India";

  return (
    <Link
      href={`/internships/${internshipSlug(internship)}`}
      className="plasma-card flex flex-col gap-3 p-4 hover:-translate-y-0.5 group"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--navy)] text-white flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
          <CompanyLogo internship={internship} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-bold leading-snug text-[var(--heading)] group-hover:text-[var(--primary)] transition-colors line-clamp-2">
            {internship.name}
          </h3>
          <p className="text-[11.5px] text-[var(--text-3)] mt-0.5 truncate">{internship.company} · via {sourceLabel(internship.source)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-[11.5px] text-[var(--text)]">
        <span className="flex items-center gap-1.5">
          {internship.isRemote ? <Wifi className="h-3 w-3 text-[var(--success)]" /> : <MapPin className="h-3 w-3 text-[var(--text-3)]" />}
          {location}
        </span>
        <StipendBadge stipend={internship.stipend} className="self-start text-[11.5px]" />
        {internship.duration && (
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-[var(--text-3)]" />{formatDuration(internship.duration)}</span>
        )}
      </div>

      {internship.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {internship.skills.slice(0, 4).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
        </div>
      )}
    </Link>
  );
}
