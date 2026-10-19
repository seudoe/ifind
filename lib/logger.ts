/**
 * iFind shared server log format (identical in resume-extractor-v3, internScraper and vectoriser: see each `ifind_log.py`).
 *
 *   14:02:11.532 │ INFO  │ ifind │ auth/login │ user signed in  username=test role=student 182ms
 *   ^dim           ^bold    ^bold   ^italic      ^plain          ^italic key = coloured value
 *
 * Levels: DEBUG (dim) INFO (cyan) OK (green) WARN (yellow) ERROR (bold red). Colour is off when stdout is not a TTY
 * or NO_COLOR is set; FORCE_COLOR=1 forces it on. Secrets (DB URIs, API keys, bearer tokens) are redacted.
 */
export type LogLevel = "debug" | "info" | "ok" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const SERVICE = "ifind";
// process is reached through globalThis so the Edge bundler does not flag Node-only APIs (this file is shared with proxy.ts).
const proc = (globalThis as { process?: { env: Record<string, string | undefined>; stdout?: { isTTY?: boolean } } }).process;
const useColor = !proc?.env.NO_COLOR && (proc?.env.FORCE_COLOR ? proc.env.FORCE_COLOR !== "0" : Boolean(proc?.stdout?.isTTY));
const paint = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const style = {
  dim: (s: string) => paint("2", s),
  bold: (s: string) => paint("1", s),
  italic: (s: string) => paint("3", s),
};

const LEVELS: Record<LogLevel, { label: string; code: string }> = {
  debug: { label: "DEBUG", code: "2;37" },
  info: { label: "INFO ", code: "1;36" },
  ok: { label: "OK   ", code: "1;32" },
  warn: { label: "WARN ", code: "1;33" },
  error: { label: "ERROR", code: "1;97;41" },
};

const SEP = style.dim("│");

/** Strips credentials from anything that is about to be printed. */
export function redact(text: string): string {
  return text
    .replace(/(mongodb(?:\+srv)?:\/\/)([^:@/\s]+):([^@\s]+)@/gi, "$1$2:***@")
    .replace(/\b(gsk_|sk-|AIza|ghp_|xox[bp]-)[A-Za-z0-9_-]{8,}/g, "$1***")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/gi, "$1***");
}

const timestamp = () => {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

const colorValue = (key: string, v: string): string => {
  if (key === "status") {
    const n = Number(v);
    return paint(n >= 500 ? "1;31" : n >= 400 ? "33" : n >= 300 ? "36" : "32", v);
  }
  if (key === "ms") return paint(Number(v) > 1000 ? "33" : "32", `${v}ms`);
  if (key === "method") return paint("1;35", v);
  return paint("97", v);
};

const fmtValue = (v: unknown): string => {
  if (v instanceof Error) return v.message;
  if (typeof v === "string") return /\s/.test(v) ? JSON.stringify(v) : v;
  if (v === undefined) return "-";
  try {
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  } catch {
    return String(v);
  }
};

export function format(level: LogLevel, scope: string, message: string, fields?: LogFields): string {
  const lv = LEVELS[level];
  const kv = fields
    ? Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${style.italic(style.dim(k + "="))}${colorValue(k, redact(fmtValue(v)))}`)
        .join(" ")
    : "";
  const body = level === "error" ? style.bold(message) : message;
  return redact(
    [style.dim(timestamp()), paint(lv.code, ` ${lv.label} `), style.bold(paint("35", SERVICE)), style.italic(paint("34", scope)), body + (kv ? "  " + kv : "")].join(` ${SEP} `),
  );
}

// The original console methods are kept on globalThis: instrumentation.ts and route handlers are bundled separately, so
// a module-level capture could run after the patch and loop back into it.
const g = globalThis as typeof globalThis & { __ifindConsole?: { out: typeof console.log; err: typeof console.error } };
g.__ifindConsole ??= { out: console.log.bind(console), err: console.error.bind(console) };
const sink = g.__ifindConsole;

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields) {
  const line = format(level, scope, message, fields);
  if (level === "error" || level === "warn") sink.err(line);
  else sink.out(line);
}

export const log = {
  debug: (scope: string, message: string, fields?: LogFields) => emit("debug", scope, message, fields),
  info: (scope: string, message: string, fields?: LogFields) => emit("info", scope, message, fields),
  ok: (scope: string, message: string, fields?: LogFields) => emit("ok", scope, message, fields),
  warn: (scope: string, message: string, fields?: LogFields) => emit("warn", scope, message, fields),
  error: (scope: string, message: string, fields?: LogFields) => emit("error", scope, message, fields),
};

/** Routes legacy `console.*("[scope] text", extra...)` calls through the formatter. */
export function formatConsoleArgs(level: LogLevel, args: unknown[]): string {
  const text = args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? `${a.message}${a.stack ? "\n" + a.stack.split("\n").slice(1, 4).join("\n") : ""}` : fmtValue(a)))
    .join(" ");
  const m = text.match(/^\s*\[([^\]]{1,40})\]\s*([\s\S]*)$/);
  return format(level, m ? m[1] : "app", (m ? m[2] : text).trim());
}

export const emitRaw = (level: LogLevel, line: string) => (level === "error" || level === "warn" ? sink.err(line) : sink.out(line));
