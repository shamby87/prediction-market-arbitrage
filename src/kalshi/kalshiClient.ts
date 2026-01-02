import { Configuration, MarketApi, Market, GetMarketsStatusEnum, MarketStatusEnum, MarketMarketTypeEnum } from "kalshi-typescript";
import { CONFIG } from "../config";

export interface KalshiMarkets {
  markets: Map<string, Market>;
  lastUpdated: Date | null;
}

export const kalshiMarkets: KalshiMarkets = {
  markets: new Map(),
  lastUpdated: null,
};

export function makeKalshiMarketsApi(): MarketApi {
  return new MarketApi(new Configuration({
    apiKey: CONFIG.kalshiApiKeyId,
    privateKeyPath: CONFIG.kalshiPrivateKeyPath,
    basePath: CONFIG.kalshiRestBaseUrl,
  }));
}

// Fetch *all* markets (with pagination) and populate kalshiMarkets.
export async function refreshKalshiMarkets(api: MarketApi): Promise<void> {
  const all: Market[] = [];

  const limit: number | undefined = 1000;
  let cursor: string | undefined = undefined;

  do {
    const { status, data } = await api.getMarkets(
      limit,
      cursor,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      GetMarketsStatusEnum.Open
    );

    all.push(...data.markets.filter(isValidMarket));

    cursor = data.cursor;
    console.log(`Fetched ${all.length} Kalshi markets`);
  } while (cursor);

  kalshiMarkets.markets = new Map(all.map((m) => [m.ticker, m]));
  kalshiMarkets.lastUpdated = new Date();

  console.log(`Kalshi markets refreshed: ${all.length} markets at ${kalshiMarkets.lastUpdated.toISOString()}`);
}

const validTickerPrefixes = [
  "KXNFLGAME",
  "KXNFLSPREAD",
  "KXNFLTOTAL",
  "KXNBAGAME",
  "KXNBASPREAD",
  "KXNBATOTAL",
]

function isValidMarket(market: Market): boolean {
  if (market.status !== MarketStatusEnum.Active || market.market_type !== MarketMarketTypeEnum.Binary) 
    return false;

  for (const prefix of validTickerPrefixes) {
    if (market.event_ticker.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}
