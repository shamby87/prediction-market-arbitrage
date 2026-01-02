import { validateConfig, CONFIG } from "./config";
import { makeClobClient, refreshPolymarketMarkets, polymarketMarkets } from "./poly/polyClient";
import { connectPolymarketOrderbook, getBooksForMarket } from "./poly/polyOrderbook";
import { findArbOpportunities } from "./arb";
import { logMsg } from "./utils";
import { kalshiMarkets, makeKalshiMarketsApi, refreshKalshiMarkets } from "./kalshi/kalshiClient";
import { connectKalshiOrderbook } from "./kalshi/kalshiOrderbook";

async function main() {
  validateConfig();

  console.log("=== Polymarket CLOB arbitrage skeleton ===");
  console.log(`CLOB host: ${CONFIG.clobHost}`);
  console.log(`Chain ID: ${CONFIG.chainId}`);
  console.log(`WS market URL: ${CONFIG.polyWsMarketUrl}`);
  console.log(`Min edge: ${CONFIG.minEdge}`);
  
  // 1. Build authenticated CLOB client (derives API keys internally). 
  const polyClient = await makeClobClient();
  console.log("ClobClient initialized.");
  const kalshiApi = makeKalshiMarketsApi();
  console.log("Kalshi MarketApi initialized.");
  
  // 2. Fetch open binary markets
  await refreshPolymarketMarkets(polyClient);
  await refreshKalshiMarkets(kalshiApi);
  
  // 3. Token IDs to subscribe in WS.
  const allPolyTokenIds = new Set<string>();
  for (const m of polymarketMarkets.markets.values()) {
    for (const token of m.tokens) {
      allPolyTokenIds.add(token.token_id);
    }
  }
  const assetIds = Array.from(allPolyTokenIds);
  console.log(`Subscribing to ${assetIds.length} token IDs on polymarket market WS...`);

  connectPolymarketOrderbook(assetIds);

  const kalshiTickers = Array.from(kalshiMarkets.markets.values()).map((m) => m.ticker);
  connectKalshiOrderbook(kalshiTickers);

  const kalshiMap = kalshiMarkets.markets;
  const pMap = polymarketMarkets.markets;

  // 4. Periodically scan for arbitrage candidates and log them.
  setInterval(async () => {
    // console.log(`Orderbook for market ${markets[0]!.question}:`);
    // const books = getBooksForMarket(markets[0]!);
    // console.log(`[${markets[0]!.tokens[0]!.outcome}] ${JSON.stringify(books[markets[0]!.tokens[0]!.outcome])}`);
    // console.log(`[${markets[0]!.tokens[1]!.outcome}] ${JSON.stringify(books[markets[0]!.tokens[1]!.outcome])}`);
    // const opps = findArbOpportunities(pairs);
    // if (!opps.length) return;

    // console.log("Arbitrage candidates:");
    // for (const o of opps) {
    //   const market = await client.getMarket(o.conditionId);
    //   logMsg(`Market: ${market.question} YES=${o.askY.toFixed(4)} NO=${o.askN.toFixed(4)} edge=${o.edge.toFixed(4)}`, true);
    // }
  }, 2_000);

  setInterval(async () => {
    logMsg(`Checking in...`, true);
  }, 900_000);
}

main().catch((err) => {
  console.error("Fatal error in main:", err);
  process.exit(1);
});
