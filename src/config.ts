import * as dotenv from "dotenv";

dotenv.config();

export const CONFIG = {
  clobHost: process.env.CLOB_HOST ?? "https://clob.polymarket.com",
  chainId: Number(process.env.CHAIN_ID ?? "137"),
  polyPrivateKey: process.env.POLY_PRIV_KEY ?? "",
  profileAddress: process.env.PROFILE_ADDR ?? "",
  kalshiApiKeyId: process.env.KALSHI_API_KEY_ID ?? "",
  kalshiPrivateKeyPath: process.env.KALSHI_PRIVATE_KEY_PATH ?? "",
  polyWsMarketUrl:
    process.env.POLY_WS_MARKET_URL ??
    "wss://ws-subscriptions-clob.polymarket.com/ws/market", // Polymarket market channel 
  kalshiRestBaseUrl:
    process.env.KALSHI_REST_BASE_URL ??
    "https://api.kalshi.com/trade-api/v2",
  kalshiWsUrl:
    process.env.KALSHI_WS_URL ??
    "wss://api.kalshi.com/trade-api/ws/v2",
  minEdge: Number(process.env.MIN_EDGE ?? "0.01"),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? "",
  discordNotifyUserId: process.env.DISCORD_NOTIFY_USER_ID ?? "",
};

export function validateConfig() {
  const missing: string[] = [];

  if (!CONFIG.polyPrivateKey) missing.push("PRIV_KEY");
  if (!CONFIG.profileAddress) missing.push("PROFILE_ADDR");

  if (missing.length) {
    throw new Error(
      `Missing required env vars: ${missing.join(
        ", ",
      )}. Put them in .env at project root.`,
    );
  }
}
