import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getOwnerMetrics } from "../lib/metrics-store.js";
import { now } from "../lib/clock.js";

const composer = new Composer<Ctx>();

const OWNER_ID = process.env.OWNER_ID
  ? parseInt(process.env.OWNER_ID, 10)
  : undefined;

composer.command("metrics", async (ctx) => {
  if (OWNER_ID !== undefined && ctx.from?.id !== OWNER_ID) {
    await ctx.reply("This command is restricted to the bot owner.");
    return;
  }

  const metrics = getOwnerMetrics(now().getTime());

  const topTickers = Object.entries(metrics.alertCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([t, c]) => `  ${t}: ${c}`)
    .join("\n");

  const typeLines = Object.entries(metrics.alertTypeCounts)
    .map(([t, c]) => `  ${t}: ${c}`)
    .join("\n");

  await ctx.reply(
    `📊 Bot metrics\n\n` +
      `Users: ${metrics.totalUsers} total, ${metrics.activeUsersLast30d} active (30d)\n\n` +
      `Top tickers by alerts:\n${topTickers || "  none yet"}\n\n` +
      `Alert types:\n${typeLines || "  none yet"}\n\n` +
      `Failed lookups: ${metrics.recentFailures}`,
  );
});

export default composer;
