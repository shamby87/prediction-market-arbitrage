interface PolymarketMarkets {
  markets: Map<string, PolymarketMarket>; // condition_id -> market
  lastUpdated: Date | null;
}

interface KalshiMarkets {
  markets: Map<string, Market>;
  lastUpdated: Date | null;
}

interface PolymarketMarket {
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

type OrderBookSide = { price: number; size: number }[];

interface PolyOrderBook {
  bids: OrderBookSide;
  asks: OrderBookSide;
}

// Note Kalshi gives us only the bids. The asks can be inferred as (1 - best bid) for the other side.
// E.g the best yes ask is (1 - best no bid)
interface KalshiOrderBook {
  yesBids: OrderBookSide; // sorted desc by price
  noBids: OrderBookSide; // sorted desc by price
}