"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Landing-page search box: sends the visitor to the public /internships list with the query applied. */
export function HeroSearch() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");

  const go = () => {
    const p = new URLSearchParams();
    if (role.trim()) p.set("q", role.trim());
    if (location.trim()) p.set("location", location.trim());
    const qs = p.toString();
    router.push(`/internships${qs ? `?${qs}` : ""}`);
  };

  const input =
    "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-[13.5px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-bg)]";

  return (
    <form onSubmit={(e) => { e.preventDefault(); go(); }} className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr_auto]">
      <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role, skill, or company..." aria-label="Role, skill, or company" className={input} />
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or Work from Home" aria-label="City or Work from Home" className={input} />
      <Button type="submit" size="lg" className="gap-2 px-6">Search <ArrowRight className="h-3.5 w-3.5" /></Button>
    </form>
  );
}
