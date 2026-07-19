import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { recordUserInteraction } from "../lib/metrics-store.js";

registerMainMenuItem({ label: "📋 Watchlist", data: "view_list:show", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("view_list:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  recordUserInteraction(ctx.from.id, Date.now());

  if (ctx.session.watchlist.length === 0) {
    await ctx.reply("Your watchlist is empty — tap ➕ Add coin to get started.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add coin", "add_coin:start")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const lines: string[] = [];
  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const item of ctx.session.watchlist) {
    const status = item.enabled ? "" : " (paused)";
    lines.push(`• ${item.ticker} — ${item.name}${status}`);

    const activeAlerts = item.alerts.filter((a) => a.enabled).length;
    const alertInfo =
      item.alerts.length > 0
        ? ` (${activeAlerts} alert${activeAlerts === 1 ? "" : "s"})`
        : "";
    rows.push([
      inlineButton(`🗑 Remove ${item.ticker}`, `view_list:remove:${item.ticker}`),
      inlineButton(`🔔 Alerts${alertInfo}`, `view_list:alerts:${item.ticker}`),
    ]);
  }

  await ctx.reply(
    `Your watchlist (${ctx.session.watchlist.length} coin${ctx.session.watchlist.length === 1 ? "" : "s"}):\n\n${lines.join("\n")}`,
    {
      reply_markup: inlineKeyboard([
        ...rows,
        [inlineButton("➕ Add coin", "add_coin:start")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^view_list:remove:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  ctx.session.pendingRemoveTicker = ticker;

  await ctx.reply(`Remove ${ticker} from your watchlist?`, {
    reply_markup: inlineKeyboard([
      [
        inlineButton("✅ Yes, remove", `view_list:confirm_remove:${ticker}`),
        inlineButton("Cancel", "view_list:show"),
      ],
    ]),
  });
});

composer.callbackQuery(/^view_list:confirm_remove:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  const idx = ctx.session.watchlist.findIndex(
    (w) => w.ticker.toUpperCase() === ticker,
  );
  if (idx === -1) {
    await ctx.reply(`${ticker} isn't on your watchlist anymore.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  ctx.session.watchlist.splice(idx, 1);
  await ctx.reply(`${ticker} removed from your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📋 View watchlist", "view_list:show")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery(/^view_list:alerts:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  const item = ctx.session.watchlist.find(
    (w) => w.ticker.toUpperCase() === ticker,
  );
  if (!item) {
    await ctx.reply(`${ticker} isn't on your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  if (item.alerts.length === 0) {
    await ctx.reply(`${ticker} has no alerts set.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔔 Add threshold alert", `alert:threshold:${ticker}`)],
        [inlineButton("📊 Add % alert", `alert:percentage:${ticker}`)],
        [inlineButton("⬅️ Back to watchlist", "view_list:show")],
      ]),
    });
    return;
  }

  const lines = item.alerts.map((a: { type: string; direction: string; value: number; enabled: boolean }, i: number) => {
    const typeLabel = a.type === "threshold" ? "Price" : "% move";
    const dirLabel =
      a.direction === "above"
        ? "above"
        : a.direction === "below"
          ? "below"
          : a.direction === "up"
            ? "up"
            : a.direction === "down"
              ? "down"
              : "any direction";
    return `${i + 1}. ${typeLabel} ${dirLabel} ${a.value}${a.type === "percentage" ? "%" : ""} ${a.enabled ? "✅" : "⏸"}`;
  });

  await ctx.reply(`${ticker} alerts:\n\n${lines.join("\n")}`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🔔 Add threshold alert", `alert:threshold:${ticker}`)],
      [inlineButton("📊 Add % alert", `alert:percentage:${ticker}`)],
      ...item.alerts.map((a: { enabled: boolean }, i: number) => [
        inlineButton(
          `${a.enabled ? "⏸ Pause" : "▶️ Resume"} alert ${i + 1}`,
          `alert:toggle:${ticker}:${i}`,
        ),
        inlineButton(`🗑 Delete alert ${i + 1}`, `alert:delete:${ticker}:${i}`),
      ]),
      [inlineButton("⬅️ Back to watchlist", "view_list:show")],
    ]),
  });
});

composer.callbackQuery(/^alert:toggle:(.+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  const alertIdx = parseInt(ctx.match[2], 10);
  const item = ctx.session.watchlist.find(
    (w) => w.ticker.toUpperCase() === ticker,
  );
  if (item && item.alerts[alertIdx]) {
    item.alerts[alertIdx].enabled = !item.alerts[alertIdx].enabled;
    const status = item.alerts[alertIdx].enabled ? "resumed" : "paused";
    await ctx.reply(`${ticker} alert ${alertIdx + 1} ${status}.`);
  }
});

composer.callbackQuery(/^alert:delete:(.+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  const alertIdx = parseInt(ctx.match[2], 10);
  const item = ctx.session.watchlist.find(
    (w) => w.ticker.toUpperCase() === ticker,
  );
  if (item && item.alerts[alertIdx]) {
    item.alerts.splice(alertIdx, 1);
    await ctx.reply(`${ticker} alert ${alertIdx + 1} deleted.`);
  }
});

export default composer;
