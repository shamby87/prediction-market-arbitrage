import { kalshiMarkets } from "./kalshi/kalshiClient";
import { polymarketMarkets } from "./poly/polyClient";

// polymarket condition ID -> [kalshi tickers]
// Kalshi has separate markets for each side of some markets, so 1 polymarket market may map to multiple Kalshi markets that rep each side.
export type PolymarketKalshiMapping = Map<string, string[]>;

export const polyToKalshiMap: PolymarketKalshiMapping = new Map();
export const kalshiToPolyMap: Map<string, string> = new Map();

export function buildPolyToKalshiBookMap(): PolymarketKalshiMapping {
    polyToKalshiMap.clear();
    const polyMarkets = polymarketMarkets.markets;
    const kMarkets = kalshiMarkets.markets;

    for (const polyMarket of polyMarkets.values()) {
        const slugParsed = polyMarket.market_slug.split("-"); // e.g., "nfl-bal-pit-2026-01-04-total-43pt5"
        const league = slugParsed[0];
        const team1 = polyAbrToKalshiAbr(slugParsed[1]!);
        const team2 = polyAbrToKalshiAbr(slugParsed[2]!);
        if (league === "nfl" || league === "nba") {
            if (slugParsed.includes("total")) {
                let pointTotal = slugParsed[slugParsed.indexOf("total") + 1];
                if (!pointTotal) {
                    console.log(`Skipping polymarket market ${polyMarket.market_slug} as point total not found.`);
                    continue;
                }
                if (pointTotal.indexOf("pt") >= 0) {
                    pointTotal = pointTotal?.substring(0, pointTotal.indexOf("pt"));
                }

                const kalshiTicker = `KX${league}TOTAL-${polyDateToKalshiDate(slugParsed.slice(3, 6))}${team1}${team2}-${pointTotal}`.toUpperCase();
                if (!kMarkets.has(kalshiTicker)) {
                    // console.log(`Kalshi market not found for ticker ${kalshiTicker}, skipping polymarket market ${polyMarket.market_slug}`);
                    continue;
                }
                polyToKalshiMap.set(polyMarket.condition_id, [kalshiTicker]);
                kalshiToPolyMap.set(kalshiTicker, polyMarket.condition_id);
                console.log(`Mapping polymarket market ${polyMarket.market_slug} to kalshi ticker ${kalshiTicker}`);
            } else {
                // Moneyline
                // NOTE: Assumes that the team order in the polymarket slug is the same as the order in Kalshi ticker
                const kalshiTickerPrefix = `KX${league}GAME-${polyDateToKalshiDate(slugParsed.slice(3, 6))}${team1}${team2}`;
                const tickers = [
                    `${kalshiTickerPrefix}-${team1}`.toUpperCase(), 
                    `${kalshiTickerPrefix}-${team2}`.toUpperCase()
                ]
                if (kMarkets.keys().filter((k) => tickers.includes(k)).toArray().length !== tickers.length) {
                    console.log(`Kalshi market not found for polymarket market ${polyMarket.market_slug}, kalshi tickers [${tickers.join(", ")}]`);
                    continue;
                }
                polyToKalshiMap.set(polyMarket.condition_id, tickers);
                tickers.forEach((t) => kalshiToPolyMap.set(t, polyMarket.condition_id));
                console.log(`Mapping polymarket market ${polyMarket.market_slug} to kalshi tickers [${tickers.join(", ")}]`);
            }
        } else {
            console.log(`Skipping polymarket market ${polyMarket.market_slug} as not NFL or NBA.`);
        }
    }

    return polyToKalshiMap;
}

// Polydate: ["2026","01","04"] -> Kalshi date: "26jan04"
function polyDateToKalshiDate(polyDate: string[]): string {
    if (polyDate.length !== 3) throw new Error(`Invalid poly date array: ${polyDate}`);
    const year = polyDate[0]?.substring(2);
    const monthNum = parseInt(polyDate[1]!);
    const day = polyDate[2];

    const monthAbbrs = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthAbbr = monthAbbrs[monthNum - 1];

    return `${year}${monthAbbr}${day}`;
}

function polyAbrToKalshiAbr(polyAbr: string): string {
    switch (polyAbr.toLowerCase()) {
        case "jax":
            return "JAC";
        default:
            return polyAbr.toUpperCase();
    }
}