import { AsyncLocalStorage } from "node:async_hooks";
import { estimateCostUsd } from "./pricing";

export interface LlmCallRecord {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface UsageContext {
  calls: LlmCallRecord[];
}

const storage = new AsyncLocalStorage<UsageContext>();

/** Runs `fn` so every provider call made inside it is collected into `ctx.calls` (see recordLlmCall). */
export function runInUsageContext<T>(ctx: UsageContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * Called by the provider wrappers after each call. Outside a billed request it does nothing, so the
 * wrappers stay safe to use from scripts and tests.
 */
export function recordLlmCall(call: {
  provider: string;
  model: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs: number;
  ok: boolean;
  error?: unknown;
}): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  const tokensIn = Math.max(0, Math.round(call.tokensIn ?? 0));
  const tokensOut = Math.max(0, Math.round(call.tokensOut ?? 0));
  ctx.calls.push({
    provider: call.provider,
    model: call.model,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(call.provider, call.model, tokensIn, tokensOut),
    latencyMs: Math.round(call.latencyMs),
    ok: call.ok,
    error: call.ok ? undefined : String(call.error instanceof Error ? call.error.message : call.error ?? "").slice(0, 200),
  });
}
