import WebSocket from "ws";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { CONFIG } from "../config";

export type OrderBookSide = { price: number; size: number }[];

export interface OrderBook {
  yes: OrderBookSide; // sorted desc by price
  no: OrderBookSide; // sorted desc by price
}

export const kalshiBooks: Record<string, OrderBook> = {}; // ticker -> book

// Sign text with RSA-PSS SHA256 and base64-encode. 
function signPss(privateKeyPem: string, text: string): string {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(text);
  signer.end();
  const sig = signer.sign({
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });
  return sig.toString("base64");
}

function loadPrivateKeyPem(): string {
  const full = path.resolve(CONFIG.kalshiPrivateKeyPath);
  return fs.readFileSync(full, "utf8");
}

function createWsHeaders(): Record<string, string> {
  const privateKeyPem = loadPrivateKeyPem();
  const method = "GET";
  const pathPart = "/trade-api/ws/v2";
  const timestamp = String(Date.now());

  const msgString = timestamp + method + pathPart;
  const signature = signPss(privateKeyPem, msgString);

  return {
    "Content-Type": "application/json",
    "KALSHI-ACCESS-KEY": CONFIG.kalshiApiKeyId,
    "KALSHI-ACCESS-SIGNATURE": signature,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
  };
}

interface OrderbookSnapshotMsg {
  type: "orderbook_snapshot";
  sid: number;
  seq: number;
  msg: {
    market_ticker: string;
    yes: [number, number][];
    yes_dollars: [string, number][];
    no: [number, number][];
    no_dollars: [string, number][];
  };
}

interface OrderbookDeltaMsg {
  type: "orderbook_delta";
  sid: number;
  seq: number;
  msg: {
    market_ticker: string;
    price: number;
    price_dollars: string;
    delta: number;
    side: "yes" | "no";
  };
}

interface SubscribedMsg {
  type: "subscribed";
  id: number;
}

interface ErrorMsg {
  type: "error";
  error: string;
}

type WsMsg =
  | OrderbookSnapshotMsg
  | OrderbookDeltaMsg
  | SubscribedMsg
  | ErrorMsg
  | any;

function upsertLevel(side: OrderBookSide, price: number, size: number) {
  const idx = side.findIndex((lvl) => lvl.price === price);
  if (size <= 0) {
    if (idx >= 0) side.splice(idx, 1);
  } else if (idx >= 0) {
    side[idx]!.size = size;
  } else {
    side.push({ price, size });
  }
  // Sort descending by price (best first) – consistent with bids semantics.
  side.sort((a, b) => b.price - a.price);
}

function handleSnapshot(msg: OrderbookSnapshotMsg) {
  const tkr = msg.msg.market_ticker;

  const yes: OrderBookSide = msg.msg.yes.map(([price, size]) => ({
    price,
    size,
  }));

  const no: OrderBookSide = msg.msg.no.map(([price, size]) => ({
    price,
    size,
  }));

  yes.sort((a, b) => b.price - a.price);
  no.sort((a, b) => b.price - a.price);

  kalshiBooks[tkr] = { yes, no };
}

function handleDelta(msg: OrderbookDeltaMsg) {
  const tkr = msg.msg.market_ticker;
  const book = kalshiBooks[tkr] || { yes: [], no: [] };

  const price = msg.msg.price;
  const delta = msg.msg.delta;
  const sideArray = msg.msg.side === "yes" ? book.yes : book.no;

  // Current size at this price; default 0 if not present.
  const existing = sideArray.find((lvl) => lvl.price === price);
  const currentSize = existing?.size ?? 0;
  const newSize = currentSize + delta;

  upsertLevel(sideArray, price, newSize);

  kalshiBooks[tkr] = book;

  // if (tkr.toLowerCase() === `kxnbagame-26jan01miadet-det`) {
  //   console.log(`Pistons: ${JSON.stringify(kalshiBooks[tkr])}`);
  // }
}

export function connectKalshiOrderbook(marketTickers: string[]) {
  const headers = createWsHeaders();

  const ws = new WebSocket(CONFIG.kalshiWsUrl, {
    headers,
  });

  ws.on("open", () => {
    console.log("Kalshi WS connected, subscribing to orderbooks:", marketTickers);

    const subscribeMsg = {
      id: 1,
      cmd: "subscribe",
      params: {
        channels: ["orderbook_delta"], // orderbook_snapshot + orderbook_delta come over this channel 
        market_tickers: marketTickers,
      },
    };

    ws.send(JSON.stringify(subscribeMsg));
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as WsMsg;
      switch (data.type) {
        case "subscribed":
          console.log("Kalshi subscribed:", data);
          break;
        case "orderbook_snapshot":
          handleSnapshot(data as OrderbookSnapshotMsg);
          break;
        case "orderbook_delta":
          handleDelta(data as OrderbookDeltaMsg);
          break;
        case "error":
          console.error("Kalshi WS error message:", data);
          break;
        default:
          // other messages: heartbeats, etc.
          break;
      }
    } catch (e) {
      console.error("Kalshi WS parse error:", e);
    }
  });

  ws.on("error", (err) => {
    console.error("Kalshi WS error:", err);
  });

  ws.on("close", () => {
    console.warn("Kalshi WS closed, consider reconnect logic.");
  });

  return ws;
}
