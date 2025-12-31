import { ClobClient } from "@polymarket/clob-client";
import { PaginationPayload } from "@polymarket/clob-client/dist/types"; // type path per package; adjust if needed 

export interface YesNoPair {
  conditionId: string;
  yesTokenId: string;
  noTokenId: string;
}

export interface PolymarketMarket {
  accepting_order_timestamp: string | null;
  accepting_orders: boolean;
  active: boolean;
  archived: boolean;
  closed: boolean;
  condition_id: string;
  description: string;
  enable_order_book: boolean;
  end_date_iso: string;
  fpmm: string;
  game_start_time: string;
  icon: string;
  image: string;
  is_50_50_outcome: boolean;
  maker_base_fee: number;
  market_slug: string;
  minimum_order_size: number;
  minimum_tick_size: number;
  neg_risk: boolean;
  neg_risk_market_id: string;
  neg_risk_request_id: string;
  notifications_enabled: boolean;
  question: string;
  question_id: string;
  rewards: {
    max_spread: number;
    min_size: number;
    rates: any | null;
  };
  seconds_delay: number;
  tags: string[];
  taker_base_fee: number;
  tokens: MarketToken[];
}

interface MarketToken {
  outcome: string;
  price: number;
  token_id: string;
  winner: boolean;
}

// Use ClobClient public method getMarkets() to fetch all markets. 
export async function fetchPolymarketMarkets(client: ClobClient): Promise<PolymarketMarket[]> {
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
    console.log(`Fetched ${markets.length} markets.`);
  } while (cursor && cursor !== "LTE=");

  return markets;
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
