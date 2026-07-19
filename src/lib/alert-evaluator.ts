import type { Ctx } from "../bot.js";
import type { WatchlistItem } from "../bot.js";
import { getMultiplePrices } from "./api.js";
import { isQuietHours, isCooldownActive, now } from "./clock.js";
import { recordAlert } from "./metrics-store.js";

export async function evaluateAlerts(ctx: Ctx): Promise<string[]> {
  const messages: string[] = [];
  if (ctx.session.watchlist.length === 0) return messages;

  const currency = ctx.session.currency ?? "usd";
  const coinIds = ctx.session.watchlist.map((w) => w.ticker.toLowerCase());
  const prices = await getMultiplePrices(coinIds, currency);

  if (isQuietHours(
    ctx.session.quietHoursStart ?? "23:00",
    ctx.session.quietHoursEnd ?? "07:00",
    ctx.session.timezone ?? "UTC",
  )) {
    return messages;
  }

  for (const item of ctx.session.watchlist) {
    if (!item.enabled) continue;

    const id = item.ticker.toLowerCase();
    const price = prices.get(id);
    if (!price) continue;

    for (const alert of item.alerts) {
      if (!alert.enabled) continue;
      if (isCooldownActive(alert.lastAlertTime, ctx.session.cooldownHours ?? 4)) continue;

      let triggered = false;
      let reason = "";

      if (alert.type === "threshold") {
        if (alert.direction === "above" && price.price > alert.value) {
          triggered = true;
          reason = `${item.ticker} is above ${alert.value} (now ${price.price.toFixed(2)})`;
        } else if (alert.direction === "below" && price.price < alert.value) {
          triggered = true;
          reason = `${item.ticker} is below ${alert.value} (now ${price.price.toFixed(2)})`;
        }
      } else {
        const change = price.change24h;
        if (alert.direction === "up" && change > alert.value) {
          triggered = true;
          reason = `${item.ticker} moved up ${change.toFixed(2)}% (threshold: ${alert.value}%)`;
        } else if (alert.direction === "down" && change < -alert.value) {
          triggered = true;
          reason = `${item.ticker} moved down ${change.toFixed(2)}% (threshold: ${alert.value}%)`;
        } else if (alert.direction === "both" && Math.abs(change) > alert.value) {
          triggered = true;
          reason = `${item.ticker} moved ${change.toFixed(2)}% (threshold: ${alert.value}%)`;
        }
      }

      if (triggered) {
        const ts = now().getTime();
        alert.lastAlertTime = ts;
        alert.lastAlertPrice = price.price;
        item.lastAlertTime = ts;
        item.lastAlertPrice = price.price;

        recordAlert({
          userId: ctx.from?.id ?? 0,
          ticker: item.ticker,
          alertType: alert.type,
          direction: alert.direction,
          value: alert.value,
          price: price.price,
          currency,
          timestamp: ts,
        });

        messages.push(`🔔 ${reason}`);
      }
    }
  }

  return messages;
}
