import WebSocket from "ws";
import { CONFIG } from "../config";

const books: Record<string, PolyOrderBook> = {};

interface BookMsg {
  event_type: "book";
  asset_id: string;
  market: string;
  timestamp: string;
  hash: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

interface PriceChange {
  asset_id: string;
  price: string;
  size: string;
  side: "BUY" | "SELL";
  hash: string;
  best_bid?: string;
  best_ask?: string;
}

interface PriceChangeMsg {
  event_type: "price_change";
  market: string;
  price_changes: PriceChange[];
  timestamp: string;
}

function upsertLevel(side: OrderBookSide, price: number, size: number) {
  const idx = side.findIndex((lvl) => lvl.price === price);
  if (size === 0) {
    if (idx >= 0) side.splice(idx, 1);
    return;
  }
  if (idx >= 0) {
    side[idx]!.size = size;
  } else {
    side.push({ price, size });
    side.sort((a, b) => a.price - b.price);
  }
}

// Apply a full book snapshot.
function handleBook(msg: BookMsg) {
  const bids: OrderBookSide = msg.bids
    .map((b) => ({
      price: Number(b.price),
      size: Number(b.size),
    }))
    .filter((x) => !Number.isNaN(x.price) && !Number.isNaN(x.size))
    // bids: sort descending by price
    .sort((a, b) => b.price - a.price);

  const asks: OrderBookSide = msg.asks
    .map((a) => ({
      price: Number(a.price),
      size: Number(a.size),
    }))
    .filter((x) => !Number.isNaN(x.price) && !Number.isNaN(x.size))
    // asks: sort ascending by price
    .sort((a, b) => a.price - b.price);

  books[msg.asset_id] = { bids, asks };
}

// Apply incremental price changes and track best bid/ask from each change.
function handlePriceChange(msg: PriceChangeMsg) {
  for (const pc of msg.price_changes) {
    const tokenId = pc.asset_id;
    const book = books[tokenId] || { bids: [], asks: [] };
    const bids = [...book.bids];
    const asks = [...book.asks];

    const price = Number(pc.price);
    const size = Number(pc.size);
    if (!Number.isNaN(price) && !Number.isNaN(size)) {
      if (pc.side === "BUY") {
        upsertLevel(bids, price, size);
      } else {
        upsertLevel(asks, price, size);
      }
    }

    // best_bid / best_ask are strings in each PriceChange; use them to correct top-of-book quickly.
    if (pc.best_bid !== undefined) {
      const bestBid = Number(pc.best_bid);
      if (!Number.isNaN(bestBid)) {
        // ensure best bid is present; size unknown -> keep existing size or 0
        const existing = bids.find((lvl) => lvl.price === bestBid);
        if (!existing) {
          bids.unshift({ price: bestBid, size: 0 });
        }
        bids.sort((a, b) => b.price - a.price);
      }
    }

    if (pc.best_ask !== undefined) {
      const bestAsk = Number(pc.best_ask);
      if (!Number.isNaN(bestAsk)) {
        const existing = asks.find((lvl) => lvl.price === bestAsk);
        if (!existing) {
          asks.push({ price: bestAsk, size: 0 });
        }
        asks.sort((a, b) => a.price - b.price);
      }
    }

    books[tokenId] = { bids, asks };
  }
}

export function connectPolymarketOrderbook(assetIds: string[]) {
  const ws = new WebSocket(CONFIG.polyWsMarketUrl);

  ws.on("open", () => {
    const sub = {
      type: "market", // channel id per docs
      assets_ids: assetIds,
    };
    ws.send(JSON.stringify(sub));
    console.log("Subscribed to market WS for", assetIds.length, "assets");
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.event_type) {
        case "book":
          handleBook(msg);
          break;
        case "price_change":
          handlePriceChange(msg);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("WS parse error:", e);
    }
  });

  ws.on("error", (err) => {
    console.error("WS error:", err);
  });

  ws.on("close", () => {
    console.warn("WS closed, consider reconnect logic.");
  });

  return ws;
}

export function getPolyBookForToken(tokenId: string): PolyOrderBook | undefined {
  return books[tokenId];
}

export function getPolyBooksForMarket(market: PolymarketMarket): Record<string, PolyOrderBook> {
  const ret : Record<string, PolyOrderBook> = {};
  for (const token of market.tokens) {
    if (books[token.token_id]) {
      ret[token.outcome] = books[token.token_id]!;
    } else {
      console.warn(`No orderbook found for token ID ${token.token_id} in market ${market.question}`);
    }
  }
  return ret;
}