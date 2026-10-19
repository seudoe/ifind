import diagnosticsChannel from "node:diagnostics_channel";
import { emitRaw, formatConsoleArgs, log } from "./lib/logger";

/**
 * Node-runtime half of instrumentation.ts (kept in its own file so the Edge build never sees Node APIs). Logging only:
 *  1. routes console.log/info/warn/error/debug through lib/logger.ts so all output shares the iFind format;
 *  2. logs outbound HTTP calls by listening to Node's undici diagnostics channels; fetch() itself is not wrapped or altered.
 */
export function registerNode() {
  const g = globalThis as typeof globalThis & { __ifindLogPatched?: boolean };
  if (g.__ifindLogPatched) return;
  g.__ifindLogPatched = true;

  const quiet = (a: unknown[]) => a.every((x) => typeof x === "string" && x.trim() === "");
  console.log = (...a: unknown[]) => (quiet(a) ? undefined : emitRaw("info", formatConsoleArgs("info", a)));
  console.info = console.log;
  console.debug = (...a: unknown[]) => (quiet(a) ? undefined : emitRaw("debug", formatConsoleArgs("debug", a)));
  console.warn = (...a: unknown[]) => (quiet(a) ? undefined : emitRaw("warn", formatConsoleArgs("warn", a)));
  console.error = (...a: unknown[]) => (quiet(a) ? undefined : emitRaw("error", formatConsoleArgs("error", a)));

  type Req = { origin?: string | URL; path?: string; method?: string };
  const started = new WeakMap<object, number>();
  const describe = (r: Req) => ({ method: (r.method ?? "GET").toUpperCase(), to: `${String(r.origin ?? "").replace(/^https?:\/\//, "")}${(r.path ?? "").split("?")[0]}` });
  const IGNORE = /telemetry\.nextjs\.org/;

  diagnosticsChannel.subscribe("undici:request:create", (m) => {
    const { request } = m as { request: Req };
    started.set(request, performance.now());
  });
  diagnosticsChannel.subscribe("undici:request:headers", (m) => {
    const { request, response } = m as { request: Req; response: { statusCode: number } };
    const t = started.get(request);
    const f = { ...describe(request), status: response.statusCode, ms: t ? Math.round(performance.now() - t) : undefined };
    if (IGNORE.test(f.to)) return;
    if (response.statusCode < 400) log.debug("http/out", "outbound call", f);
    else log.warn("http/out", "outbound call failed", f);
  });
  diagnosticsChannel.subscribe("undici:request:error", (m) => {
    const { request, error } = m as { request: Req; error: Error };
    const t = started.get(request);
    const f = { ...describe(request), ms: t ? Math.round(performance.now() - t) : undefined, error: error?.message };
    if (!IGNORE.test(f.to)) log.error("http/out", "outbound call unreachable", f);
  });

  log.ok("server", "logging initialised", { node: process.version, env: process.env.NODE_ENV, pid: process.pid });
}
