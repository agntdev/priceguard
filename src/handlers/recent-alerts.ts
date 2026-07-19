import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getRecentAlerts } from "../lib/metrics-store.js";

const composer = new Composer<Ctx>();

const OWNER_ID = process.env.OWNER_ID
  ? parseInt(process.env.OWNER_ID, 10)
  : undefined;

composer.command("recent-alerts", async (ctx) => {
  if (OWNER_ID !== undefined && ctx.from?.id !== OWNER_ID) {
    await ctx.reply("This command is restricted to the bot owner.");
    return;
  }

  const alerts = getRecentAlerts(20);

  if (alerts.length === 0) {
    await ctx.reply("No alerts have been triggered yet.");
    return;
  }

  const lines = alerts.map((a) => {
    const date = new Date(a.timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} — ${a.ticker} ${a.alertType} ${a.direction} ${a.value} (price: ${a.price} ${a.currency.toUpperCase()})`;
  });

  await ctx.reply(
    `Recent alerts (${alerts.length}):\n\n${lines.join("\n")}`,
  );
});

export default composer;
