import { validateConfig, CONFIG } from "./config";
import { makeClobClient } from "./poly/polyClient";
import { fetchPolymarketMarkets } from "./poly/polyMarkets";
import { connectMarketWS, getBooksForMarket } from "./poly/polyOrderbook";
import { findArbOpportunities } from "./arb";
import { logMsg } from "./utils";

async function main() {
  validateConfig();

  console.log("=== Polymarket CLOB arbitrage skeleton ===");
  console.log(`CLOB host: ${CONFIG.clobHost}`);
  console.log(`Chain ID: ${CONFIG.chainId}`);
  console.log(`WS market URL: ${CONFIG.polyWsMarketUrl}`);
  console.log(`Min edge: ${CONFIG.minEdge}`);
  
  // 1. Build authenticated CLOB client (derives API keys internally). 
  const client = await makeClobClient();
  console.log("ClobClient initialized.");

  // 2. Fetch open binary markets via clobClient.getMarkets(). 
  const markets = await fetchPolymarketMarkets(client);
  if (!markets.length) {
    console.log("No open valid markets found.");
    return;
  }

  console.log(`Got ${markets.length} valid markets.`);

  // // console.log("Market 1: ", await client.getMarket(pairs[0]!.conditionId));

  // 3. Token IDs to subscribe in WS.
  const allTokenIds = new Set<string>();
  for (const m of markets) {
    for (const token of m.tokens) {
      allTokenIds.add(token.token_id);
    }
  }
  const assetIds = Array.from(allTokenIds);
  console.log(`Subscribing to ${assetIds.length} token IDs on market WS...`);

  connectMarketWS(assetIds);

  // 4. Periodically scan for arbitrage candidates and log them.
  setInterval(async () => {
    console.log(`Orderbook for market ${markets[0]!.question}:`);
    const books = getBooksForMarket(markets[0]!);
    console.log(`[${markets[0]!.tokens[0]!.outcome}] ${JSON.stringify(books[markets[0]!.tokens[0]!.outcome])}`);
    console.log(`[${markets[0]!.tokens[1]!.outcome}] ${JSON.stringify(books[markets[0]!.tokens[1]!.outcome])}`);
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
