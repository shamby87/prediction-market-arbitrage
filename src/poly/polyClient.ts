import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import { CONFIG } from "../config";
import { PaginationPayload } from "@polymarket/clob-client/dist/types"; // type path per package; adjust if needed 

export const polymarketMarkets: PolymarketMarkets = {
  markets: new Map(),
  lastUpdated: null,
};

export async function makeClobClient(): Promise<ClobClient> {
  const signer = new Wallet(CONFIG.polyPrivateKey);

  // First, make a temporary client to derive API credentials (L2). 
  const temp = new ClobClient(CONFIG.clobHost, CONFIG.chainId, signer);
  // return temp;

  // console.log("test");
  const apiCreds = await temp.createOrDeriveApiKey();
  // console.log(`Using API credentials: ${JSON.stringify(apiCreds)}`);

  // Signature type: 2 (browser wallet) or 1 (email login). Adjust as needed; 2 is common for Metamask-like logins. 
  const signatureType = 2;

  const client = new ClobClient(
    CONFIG.clobHost,
    CONFIG.chainId,
    signer,
    apiCreds,
    signatureType,
    CONFIG.profileAddress,
  );

  return client;
}

// Use ClobClient public method getMarkets() to fetch all markets. 
export async function refreshPolymarketMarkets(client: ClobClient): Promise<void> {
  const markets: PolymarketMarket[] = [];
  let cursor: string | undefined = undefined;

  // getMarkets() returns a PaginationPayload { data, next_cursor }. 
  do {
    const page = (await client.getMarkets(cursor)) as PaginationPayload; 
    if (!page || !page.data) {
      console.log("No more markets to fetch. cursor:", cursor);
      break;
    };
    markets.push(...(page.data as PolymarketMarket[]).filter(isValidMarket));
    cursor = page.next_cursor ?? undefined;
    console.log(`Fetched ${markets.length} polymarket markets.`);
  } while (cursor && cursor !== "LTE=");

  polymarketMarkets.markets = new Map(markets.map((m) => [m.condition_id, m]));
  polymarketMarkets.lastUpdated = new Date();

  console.log(`Polymarket markets refreshed: ${markets.length} markets at ${polymarketMarkets.lastUpdated.toISOString()}`);
}

// Extract open binary markets and their YES/NO token IDs.
function isValidMarket(market: PolymarketMarket): boolean {
  // Skip closed markets.
  if (market.closed || market.archived || !market.active || !market.accepting_orders || !market.enable_order_book) return false;

  // Skip games that have already started
  const now = new Date();
  const marketDate = new Date(market.game_start_time);
  if (marketDate.getTime() < now.getTime()) return false;

  if (!market.tokens || market.tokens.length !== 2) return false;

  // if (market.question.toUpperCase().includes("RAVENS") || market.question.toUpperCase().includes("STEELERS")) {
  if (market.description.toLowerCase().includes("in the upcoming nfl game") || market.description.toLowerCase().includes("in the upcoming nba game")) {
      // console.log("Market: ", market.question);
      if (market.question.toLowerCase().includes("vs.")) {
        return true;
      }
  }

  return false;
}
