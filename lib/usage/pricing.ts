/**
 * Price table in USD per million tokens. These are estimates for budgeting, not invoices:
 * update them when a provider changes its prices. internScraper/usage_log.py keeps the same Cohere numbers.
 */
interface Price { in: number; out: number }

const PRICES: Record<string, Price> = {
  "groq:llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
  "groq:llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
  "groq:mixtral-8x7b-32768": { in: 0.24, out: 0.24 },
  "openai:gpt-4o": { in: 2.5, out: 10 },
  "gemini:gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "cohere:command-a-03-2025": { in: 2.5, out: 10 },
};

/** Used for a model that isn't in the table, so an unknown model is never logged as free. */
const FALLBACK: Price = { in: 2.5, out: 10 };

export function estimateCostUsd(provider: string, model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICES[`${provider}:${model}`] ?? FALLBACK;
  const cost = (tokensIn * price.in + tokensOut * price.out) / 1_000_000;
  return Math.round(cost * 1e8) / 1e8;
}
