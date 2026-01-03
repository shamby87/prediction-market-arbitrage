import { getPolyBookForToken } from "./poly/polyOrderbook";
import { CONFIG } from "./config";
import { PolymarketKalshiMapping } from "./helpers";
import { polymarketMarkets } from "./poly/polyClient";
import { getKalshiBookForTicker } from "./kalshi/kalshiOrderbook";
import { logMsg } from "./logging";

export interface ArbitrageOpportunity {
  polyTokenId: string;
  kalshiTicker: string;
  kalshiSide: "yes" | "no";
  polyAskPrice: number;
  kalshiAskPrice: number;
  edge: number;
}

function bestAsk(book: PolyOrderBook | undefined): number | null {
  if (!book || !book.asks.length) return null;
  return book.asks[0]!.price;
}

function bestKalshiYesAsk(book: KalshiOrderBook | undefined): number | null {
  if (!book || !book.noBids.length) return null;
  return 100 - book.noBids[0]!.price;
}

function bestKalshiNoAsk(book: KalshiOrderBook | undefined): number | null {
  if (!book || !book.yesBids.length) return null;
  return 100 - book.yesBids[0]!.price;
}

export function findArbOpportunities(mapping: PolymarketKalshiMapping, minEdge: number = CONFIG.minEdge): ArbitrageOpportunity[] {
  const opps: ArbitrageOpportunity[] = [];
  for (const [polyConditionId, kalshiTickers] of mapping.entries()) {
    const polyMarket = polymarketMarkets.markets.get(polyConditionId);
    if (!polyMarket) continue;

    const polyBook1 = getPolyBookForToken(polyMarket.tokens[0]!.token_id);
    const polyBook2 = getPolyBookForToken(polyMarket.tokens[1]!.token_id);

    const polyAsk1 = bestAsk(polyBook1); // Team 1 to win or "yes" for non moneyline
    const polyAsk2 = bestAsk(polyBook2);

    let edge = 0;
    let op: ArbitrageOpportunity = {} as ArbitrageOpportunity;
    if (kalshiTickers.length === 1) {
      const kalshiBook = getKalshiBookForTicker(kalshiTickers[0]!);

      if (polyAsk1) {
        const noAsk = bestKalshiNoAsk(kalshiBook);
        if (noAsk) {
          const sum = polyAsk1 + noAsk/100;
          if (edge < (1 - sum)) {
            edge = 1 - sum;
            op = {
              polyTokenId: polyMarket.tokens[0]!.token_id,
              kalshiTicker: `${kalshiTickers[0]}`,
              kalshiSide: "no",
              polyAskPrice: polyAsk1,
              kalshiAskPrice: noAsk,
              edge,
            }
          }
        }
      }
      if (polyAsk2) {
        const yesAsk = bestKalshiYesAsk(kalshiBook);
        if (yesAsk) {
          const sum = polyAsk2 + yesAsk/100;
          if (edge < (1 - sum)) {
            edge = 1 - sum;
            op = {
              polyTokenId: polyMarket.tokens[1]!.token_id,
              kalshiTicker: `${kalshiTickers[0]}`,
              kalshiSide: "yes",
              polyAskPrice: polyAsk2,
              kalshiAskPrice: yesAsk,
              edge,
            }
          }
        }
      }
    } else if (kalshiTickers.length === 2) {
      // NOTE: Assumes kalshiTickers[0] maps to token1 result (e.g MIA to win), kalshiTickers[1] maps to token2
      const kalshiBook1 = getKalshiBookForTicker(kalshiTickers[0]!);
      const kalshiBook2 = getKalshiBookForTicker(kalshiTickers[1]!);
      
      // Example: team 1 = MIA, team 2 = NE
      // polyBook1 = MIA to win, polyBook2 = NE to win
      // kalshiBook1 = MIA win (yes) or lose (no), kalshiBook2 = NE win (yes) or lose (no)
      // Check: polyBook1 best ask vs kalshiBook1 best no ask (i.e. kalshiBook1 yes bid)
      //                              kalshiBook2 best yes ask
      // Check: polyBook2 best ask vs kalshiBook2 best no ask
      //                              kalshiBook1 best yes ask
      if (polyAsk1) {
        const noAsk = bestKalshiNoAsk(kalshiBook1);
        const yesAsk = bestKalshiYesAsk(kalshiBook2);
        if (noAsk) {
          const sum = polyAsk1 + noAsk/100;
          if (edge < (1 - sum)) {
            edge = 1 - sum;
            op = {
              polyTokenId: polyMarket.tokens[0]!.token_id,
              kalshiTicker: `${kalshiTickers[0]}`,
              kalshiSide: "no",
              polyAskPrice: polyAsk1,
              kalshiAskPrice: noAsk,
              edge,
            }
          }
        }
        if (yesAsk) {
          const sum = polyAsk1 + yesAsk/100;
          if (edge < (1 - sum)) {
            edge = 1 - sum;
            op = {
              polyTokenId: polyMarket.tokens[0]!.token_id,
              kalshiTicker: `${kalshiTickers[1]}`,
              kalshiSide: "yes",
              polyAskPrice: polyAsk1,
              kalshiAskPrice: yesAsk,
              edge,
            }
          }
        }
      }
      if (polyAsk2) {
        const noAsk = bestKalshiNoAsk(kalshiBook2);
        const yesAsk = bestKalshiYesAsk(kalshiBook1);
        if (noAsk) {
          const sum = polyAsk2 + noAsk/100;
          if (edge < (1 - sum)) {
            edge = 1 - sum;
            op = {
              polyTokenId: polyMarket.tokens[1]!.token_id,
              kalshiTicker: `${kalshiTickers[1]}`,
              kalshiSide: "no",
              polyAskPrice: polyAsk2,
              kalshiAskPrice: noAsk,
              edge,
            }
          }
        }
        if (yesAsk) {
          const sum = polyAsk2 + yesAsk/100;
          if (edge < (1 - sum)) {
            edge = 1 - sum;
            op = {
              polyTokenId: polyMarket.tokens[1]!.token_id,
              kalshiTicker: `${kalshiTickers[0]}`,
              kalshiSide: "yes",
              polyAskPrice: polyAsk2,
              kalshiAskPrice: yesAsk,
              edge,
            }
          }
        }
      }
    }

    if (edge >= minEdge) {
      logMsg(`Arbitrage opportunity found for polymarket ${polyMarket.market_slug}: kalshiTicker=${op.kalshiTicker} kalshiSide=${op.kalshiSide} polyAsk=${op.polyAskPrice.toFixed(4)} kalshiAsk=${op.kalshiAskPrice.toFixed(4)} edge=${op.edge.toFixed(4)}`, true);
      opps.push(op);
    }
  }

  return opps;
}
