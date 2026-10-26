// `npm run dev`: next dev on port 4000 (off the usual 3000). If 4000 is taken, warns loudly and moves to the next free port.
// The chosen port is also exported as NEXT_PUBLIC_APP_URL so links, emails and redirects built from it stay correct.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";

const PREFERRED = Number(process.env.PORT) || 4000;
const RED = "\x1b[1;97;41m", BOLD = "\x1b[1m", GREEN = "\x1b[1;32m", DIM = "\x1b[2m", OFF = "\x1b[0m";

const free = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port);
  });

let port = PREFERRED;
while (!(await free(port))) port++;

if (port !== PREFERRED) {
  const width = 78;
  const lines = [
    "",
    `  WARNING: PORT ${PREFERRED} IS ALREADY IN USE`,
    `  ifind will start on port ${port} instead.`,
    "  You may need to reconfigure internScraper and the vectoriser (MAIN_URL / MAIN_PROJECT_URL)",
    `  so they allow http://localhost:${port}`,
    "",
  ];
  console.error("");
  for (const line of lines) console.error(`${RED}${line.padEnd(width)}${OFF}`);
  console.error("");
}

// the URLs Next will load from the env files (later file wins), shown so you can see what this instance talks to
const fromFiles = {};
for (const file of [".env", ".env.local", ".env.development", ".env.development.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^(INTERNSCRAPER_URL|VECTORISER_URL)=(.*)$/);
    if (m) fromFiles[m[1]] = m[2].trim();
  }
}
const urlOf = (key) => process.env[key] ?? fromFiles[key] ?? "(not set)";

const bar = "─".repeat(66);
console.log(`\n${DIM}${bar}${OFF}`);
console.log(`  ${BOLD}ifind${OFF}  starting on ${GREEN}port ${port}${OFF}`);
console.log(`  ${"App".padEnd(24)} http://localhost:${port}`);
console.log(`  ${"internScraper".padEnd(24)} ${urlOf("INTERNSCRAPER_URL")}`);
console.log(`  ${"Vectoriser".padEnd(24)} ${urlOf("VECTORISER_URL")}`);
console.log(`${DIM}${bar}${OFF}\n`);

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_APP_URL: `http://localhost:${port}` },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
