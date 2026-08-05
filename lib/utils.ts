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

export function formatDuration(duration: { value: number; unit: string }): string {
  return `${duration.value} ${duration.unit}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    applied:     "bg-blue-100 text-blue-700",
    shortlisted: "bg-green-100 text-green-700",
    rejected:    "bg-red-100 text-red-700",
    selected:    "bg-purple-100 text-purple-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}
