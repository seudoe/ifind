import type { Instrumentation } from "next";

/** Server-side logging only; no application logic. The Node-specific work lives in instrumentation-node.ts. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    registerNode();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("./lib/logger");
  log.error("request", err instanceof Error ? err.message : String(err), {
    method: request.method,
    path: request.path,
    route: context.routePath,
    kind: context.routeType,
    digest: typeof err === "object" && err && "digest" in err ? String((err as { digest: unknown }).digest) : undefined,
  });
};
