"use client";

import { useState, useCallback } from "react";
import type { InternshipFilters } from "@/types";

const DEFAULT_FILTERS: InternshipFilters = {
  stipendType: "any",
  stipendMin: 0,
  stipendMax: 100000,
  locations: [],
  workFromHome: false,
  durationMin: 1,
  durationMax: 12,
  skills: [],
  companies: [],
  perks: [],
  sortBy: "latest",
};

export function useFilters() {
  const [filters, setFilters] = useState<InternshipFilters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof InternshipFilters>(key: K, value: InternshipFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const toggleLocation = useCallback((location: string) => {
    setFilters((prev) => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter((l) => l !== location)
        : [...prev.locations, location],
    }));
  }, []);

  const togglePerk = useCallback((perk: string) => {
    setFilters((prev) => ({
      ...prev,
      perks: prev.perks.includes(perk)
        ? prev.perks.filter((p) => p !== perk)
        : [...prev.perks, perk],
    }));
  }, []);

  const addSkill = useCallback((skill: string) => {
    setFilters((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill) ? prev.skills : [...prev.skills, skill],
    }));
  }, []);

  const removeSkill = useCallback((skill: string) => {
    setFilters((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  }, []);

  return {
    filters,
    updateFilter,
    resetFilters,
    toggleLocation,
    togglePerk,
    addSkill,
    removeSkill,
  };
}
