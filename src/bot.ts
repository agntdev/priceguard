import { Composer } from "grammy";
import { readdirSync } from "node:fs";
import { createBot, type BotContext } from "./toolkit/index.js";
import { resetMetricsStore } from "./lib/metrics-store.js";

export interface AlertRule {
  type: "threshold" | "percentage";
  direction: "above" | "below" | "up" | "down" | "both";
  value: number;
  enabled: boolean;
  lastAlertTime?: number;
  lastAlertPrice?: number;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  alerts: AlertRule[];
  enabled: boolean;
  lastAlertTime?: number;
  lastAlertPrice?: number;
}

export interface Session {
  step?: string;
  pendingTicker?: string;
  pendingCoinName?: string;
  pendingAlertType?: "threshold" | "percentage";
  pendingAlertDirection?: string;
  pendingAlertValue?: number;
  pendingRemoveTicker?: string;
  pendingTimezone?: string;
  pendingCurrency?: string;
  pendingSummaryTime?: string;
  watchlist: WatchlistItem[];
  timezone: string;
  currency: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  summaryTime?: string;
  cooldownHours: number;
}

export type Ctx = BotContext<Session>;

export async function buildBot(token: string) {
  resetMetricsStore();
  const bot = createBot<Session>(token, {
    initial: () => ({
      watchlist: [],
      timezone: "UTC",
      currency: "usd",
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      cooldownHours: 4,
    }),
  });

  const dir = new URL("./handlers/", import.meta.url);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(
      (f) =>
        (f.endsWith(".js") || f.endsWith(".ts")) &&
        !f.endsWith(".d.ts") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    files = [];
  }
  for (const file of files.sort()) {
    const mod = (await import(new URL(file, dir).href)) as { default?: Composer<Ctx> };
    if (!mod.default) {
      throw new Error(`handler ${file} must default-export a grammY Composer`);
    }
    bot.use(mod.default);
  }

  bot.on("message", (ctx) => ctx.reply("Sorry, I didn't understand that. Try /help."));

  return bot;
}
