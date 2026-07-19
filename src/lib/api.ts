const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export interface CoinPrice {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  change1h: number;
  change24h: number;
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
}

let fetchFn: typeof globalThis.fetch = globalThis.fetch;

export function setFetch(fn: typeof globalThis.fetch) {
  fetchFn = fn;
}

async function coingeckoGet(path: string): Promise<unknown> {
  const res = await fetchFn(`${COINGECKO_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }
  return res.json();
}

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const data = (await coingeckoGet(
    `/search?query=${encodeURIComponent(query)}`,
  )) as { coins?: Array<{ id: string; symbol: string; name: string }> };
  return (data.coins ?? []).slice(0, 8).map((c) => ({
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
  }));
}

export async function getCoinPrice(
  coinId: string,
  currency: string,
): Promise<CoinPrice | null> {
  try {
    const data = (await coingeckoGet(
      `/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true&include_last_updated_at=true`,
    )) as Record<string, Record<string, number> & { [key: string]: number }>;
    const coinData = data[coinId];
    if (!coinData) return null;
    return {
      ticker: coinId,
      name: coinId,
      price: coinData[currency] ?? 0,
      currency,
      change1h: 0,
      change24h: coinData[`${currency}_24h_change`] ?? 0,
    };
  } catch {
    return null;
  }
}

export async function getMultiplePrices(
  coinIds: string[],
  currency: string,
): Promise<Map<string, CoinPrice>> {
  const results = new Map<string, CoinPrice>();
  if (coinIds.length === 0) return results;

  const ids = coinIds.join(",");
  try {
    const data = (await coingeckoGet(
      `/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true`,
    )) as Record<string, Record<string, number> & { [key: string]: number }>;

    for (const [id, coinData] of Object.entries(data)) {
      results.set(id, {
        ticker: id,
        name: id,
        price: coinData[currency] ?? 0,
        currency,
        change1h: 0,
        change24h: coinData[`${currency}_24h_change`] ?? 0,
      });
    }
  } catch {
    // Return empty on failure
  }
  return results;
}

export async function resolveCoinByTicker(
  ticker: string,
): Promise<CoinSearchResult | null> {
  const results = await searchCoins(ticker);
  if (results.length === 0) return null;
  const exact = results.find(
    (r) => r.symbol.toUpperCase() === ticker.toUpperCase(),
  );
  return exact ?? results[0];
}

export const POPULAR_COINS = [
  { ticker: "BTC", name: "Bitcoin", id: "bitcoin" },
  { ticker: "ETH", name: "Ethereum", id: "ethereum" },
  { ticker: "SOL", name: "Solana", id: "solana" },
  { ticker: "XRP", name: "XRP", id: "ripple" },
  { ticker: "ADA", name: "Cardano", id: "cardano" },
  { ticker: "DOGE", name: "Dogecoin", id: "dogecoin" },
];
