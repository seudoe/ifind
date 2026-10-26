import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatStipend(stipend: { type: string; amount?: number | null; currency?: string | null; period?: string | null }): string {
  if (stipend.type === "unpaid") return "Unpaid";
  if (stipend.type === "performance-based") return "Performance Based";
  if (!stipend.amount) return "Paid";
  const symbol = stipend.currency === "USD" ? "$" : "₹";
  return `${symbol}${stipend.amount.toLocaleString("en-IN")}/${stipend.period === "weekly" ? "wk" : stipend.period === "lump-sum" ? "lump sum" : "mo"}`;
}

/** "2025-07-01" -> "Jul 2025" for resume periods; anything unparseable is returned as written. */
export function formatPeriod(period?: { start?: string | null; end?: string | null; isCurrent?: boolean } | null): string {
  if (!period) return "";
  const month = (v?: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  };
  const start = month(period.start);
  const end = period.isCurrent ? "Present" : month(period.end);
  return [start, end].filter(Boolean).join(" – ");
}

/** Deadline state for a listing. A date-only deadline (midnight) counts as open until the end of that day. */
export function deadlineState(deadline: unknown): { passed: boolean; soon: boolean } {
  if (!deadline) return { passed: false, soon: false };
  const d = new Date(typeof deadline === "object" && deadline !== null && "$date" in deadline ? (deadline as { $date: string }).$date : (deadline as string));
  if (Number.isNaN(d.getTime())) return { passed: false, soon: false };
  const end = d.getUTCHours() + d.getUTCMinutes() + d.getUTCSeconds() === 0 ? d.getTime() + 86399999 : d.getTime();
  const left = end - Date.now();
  return { passed: left < 0, soon: left >= 0 && left < 7 * 86400000 };
}

export function formatDuration(duration: { value: number; unit: string }): string {
  return `${duration.value} ${duration.unit}`;
}

export function formatDate(dateValue: any): string {
  if (!dateValue) return "N/A";
  let parsedDate: Date;
  
  if (typeof dateValue === "string" || typeof dateValue === "number") {
    parsedDate = new Date(dateValue);
  } else if (typeof dateValue === "object") {
    if (dateValue.$date) {
      if (typeof dateValue.$date === "string" || typeof dateValue.$date === "number") {
        parsedDate = new Date(dateValue.$date);
      } else if (dateValue.$date.$numberLong) {
        parsedDate = new Date(Number(dateValue.$date.$numberLong));
      } else {
        return "N/A";
      }
    } else if (typeof dateValue.getTime === "function") {
      parsedDate = dateValue;
    } else {
      return "N/A";
    }
  } else {
    return "N/A";
  }

  if (isNaN(parsedDate.getTime())) return "N/A";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getInternshipId(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item._id === "string") return item._id;
  if (item._id && typeof item._id === "object") {
    if (item._id.$oid) return item._id.$oid;
    if (typeof item._id.toString === "function") return item._id.toString();
  }
  if (typeof item.toString === "function") return item.toString();
  return String(item._id || "");
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    applied:     "bg-blue-100 text-blue-700",
    shortlisted: "bg-green-100 text-green-700",
    rejected:    "bg-red-100 text-red-700",
    selected:    "bg-purple-100 text-purple-700",
    withdrawn:   "bg-gray-100 text-gray-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}
