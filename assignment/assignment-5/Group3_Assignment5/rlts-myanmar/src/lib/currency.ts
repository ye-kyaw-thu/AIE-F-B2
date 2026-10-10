import type { Currency } from "@/lib/types";

export const CURRENCIES: Currency[] = ["USD", "CNY", "MMK"];

export const CURRENCY_LABEL: Record<Currency, string> = {
  USD: "US Dollar (USD)",
  CNY: "Chinese Yuan (CNY)",
  MMK: "Myanmar Kyat (MMK)",
};

export function formatCurrency(value: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: currency === "MMK" ? "code" : "symbol",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
}

// Static demo FX rates against USD — NOT live rates. Good enough to show "roughly what
// this is worth in the other two currencies" on screen; do not use for real settlement.
const RATE_PER_USD: Record<Currency, number> = { USD: 1, CNY: 7.1, MMK: 2100 };

export function convertCurrency(value: number, from: Currency, to: Currency): number {
  if (from === to) return value;
  const usd = value / RATE_PER_USD[from];
  return usd * RATE_PER_USD[to];
}
