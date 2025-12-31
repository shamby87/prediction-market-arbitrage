import { books, OrderBook } from "./poly/polyOrderbook";
import { YesNoPair } from "./poly/polyMarkets";
import { CONFIG } from "./config";

function bestAsk(book: OrderBook | undefined): number | null {
  if (!book || !book.asks.length) return null;
  return book.asks[0]!.price;
}

// YES+NO < 1 - edge => theoretical arbitrage opportunity.
export function findArbOpportunities(
  pairs: YesNoPair[],
  minEdge = CONFIG.minEdge,
) {
  const opps: {
    conditionId: string;
    askY: number;
    askN: number;
    edge: number;
  }[] = [];

  for (const pair of pairs) {
    const yesBook = books[pair.yesTokenId];
    const noBook = books[pair.noTokenId];

    const askY = bestAsk(yesBook);
    const askN = bestAsk(noBook);

    if (askY == null || askN == null) continue;
    // console.log(`Pair: ${pair.conditionId} - ${askY} + ${askN}`);

    const sum = askY + askN;
    const edge = 1 - sum;

    if (edge > minEdge) {
      opps.push({
        conditionId: pair.conditionId,
        askY,
        askN,
        edge,
      });
    }
  }

  return opps;
}
