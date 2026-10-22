import { connectDB } from "@/lib/db";
import { getUsageSettings } from "@/lib/usage/settings";
import { overSystemBudget } from "@/lib/usage/quota";
import User from "@/models/User";

/**
 * Takes one of the user's monthly AI extractions in a single atomic update. Reading the counter, calling the
 * provider and saving the new count later (what the routes used to do) lets N parallel uploads all see "0 used"
 * and all reach the paid model. Returns false when the month's allowance is gone.
 */
export async function reserveAiExtraction(userId: string, month: string, limit: number): Promise<boolean> {
  await connectDB();
  // First request of a new month resets the counter once; the filter makes this a no-op for everyone after.
  await User.updateOne({ _id: userId, aiExtractionMonthYear: { $ne: month } }, { $set: { aiExtractionMonthYear: month, aiExtractionUsedThisMonth: 0 } });
  const res = await User.updateOne(
    {
      _id: userId,
      aiExtractionMonthYear: month,
      $or: [{ aiExtractionUsedThisMonth: { $lt: limit } }, { aiExtractionUsedThisMonth: { $exists: false } }, { aiExtractionUsedThisMonth: null }],
    },
    { $inc: { aiExtractionUsedThisMonth: 1 } },
  );
  return res.modifiedCount === 1;
}

/** Hands the extraction back when the provider failed, so a failure does not eat the allowance. */
export async function releaseAiExtraction(userId: string): Promise<void> {
  await connectDB();
  await User.updateOne({ _id: userId, aiExtractionUsedThisMonth: { $gt: 0 } }, { $inc: { aiExtractionUsedThisMonth: -1 } });
}

export async function aiExtractionsUsed(userId: string): Promise<number> {
  await connectDB();
  return (await User.findById(userId, { aiExtractionUsedThisMonth: 1 }).lean())?.aiExtractionUsedThisMonth ?? 0;
}

/** False once the site-wide daily AI budget is spent: the paid extractor then falls back to the free one. */
export async function paidAiAllowed(): Promise<boolean> {
  try {
    return !(await overSystemBudget((await getUsageSettings()).systemDailyBudgetUsd));
  } catch {
    return false; // cannot read the spend: do not call the paid model
  }
}
