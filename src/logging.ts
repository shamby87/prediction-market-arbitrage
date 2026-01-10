import fetch from "node-fetch";
import { CONFIG } from "./config";

export async function logMsg(content: string, discord: boolean = false, notify: boolean = false) {
  const msg = `[${new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})}] ${content}`;
  console.log(msg);

    if (discord) {
        await sendDiscordMessage(msg, notify);
    }
}

export async function sendDiscordMessage(content: string, notify: boolean = false) {
  if (!CONFIG.discordWebhookUrl) {
    console.warn("DISCORD_WEBHOOK_URL not set, skipping Discord notification.");
    return;
  }

  content = `${notify && CONFIG.discordNotifyUserId ? `<@${CONFIG.discordNotifyUserId}> ` : ""}${content}`;

  try {
    const res = await fetch(CONFIG.discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Discord webhook error:", res.status, res.statusText, text);
    }
  } catch (err) {
    console.error("Discord webhook exception:", err);
  }
}
