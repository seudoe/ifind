/* eslint-disable @next/next/no-img-element -- logos come from ImageKit/arbitrary hosts */
import type { Internship } from "@/types";

/** Company logo when the listing has one (iFind posts), otherwise the company's first letter. */
export function CompanyLogo({ internship }: { internship: Pick<Internship, "company" | "companyLogo"> }) {
  return internship.companyLogo
    ? <img src={internship.companyLogo} alt="" className="h-full w-full rounded-[inherit] object-cover" />
    : <>{internship.company[0]}</>;
}
