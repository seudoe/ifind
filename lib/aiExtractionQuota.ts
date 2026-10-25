import { getUsageSettings } from "@/lib/usage/settings";
import { overSystemBudget } from "@/lib/usage/quota";

/** False once the site-wide daily AI budget is spent: the paid extractor then falls back to the free one. */
export async function paidAiAllowed(): Promise<boolean> {
  try {
    return !(await overSystemBudget((await getUsageSettings()).systemDailyBudgetUsd));
  } catch {
    return false; // cannot read the spend: do not call the paid model
  }
}
