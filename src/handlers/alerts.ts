import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

composer.callbackQuery(/^alert:threshold:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  ctx.session.pendingAlertType = "threshold";
  ctx.session.pendingTicker = ticker;
  ctx.session.step = "awaiting_alert_direction";

  await ctx.reply(`${ticker} — alert when price goes:`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📈 Above", `alert:set_dir:above:${ticker}`)],
      [inlineButton("📉 Below", `alert:set_dir:below:${ticker}`)],
      [inlineButton("Cancel", "add_coin:cancel")],
    ]),
  });
});

composer.callbackQuery(/^alert:percentage:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  ctx.session.pendingAlertType = "percentage";
  ctx.session.pendingTicker = ticker;
  ctx.session.step = "awaiting_alert_direction";

  await ctx.reply(`${ticker} — alert when price moves:`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📈 Up", `alert:set_dir:up:${ticker}`)],
      [inlineButton("📉 Down", `alert:set_dir:down:${ticker}`)],
      [inlineButton("↕️ Both", `alert:set_dir:both:${ticker}`)],
      [inlineButton("Cancel", "add_coin:cancel")],
    ]),
  });
});

composer.callbackQuery(/^alert:set_dir:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const direction = ctx.match[1];
  const ticker = ctx.match[2].toUpperCase();
  ctx.session.pendingAlertDirection = direction;
  ctx.session.pendingTicker = ticker;
  ctx.session.step = "awaiting_alert_value";

  const isThreshold = ctx.session.pendingAlertType === "threshold";
  const placeholder = isThreshold ? "e.g. 50000" : "e.g. 5";

  await ctx.reply(
    isThreshold
      ? `${ticker} — enter the price threshold:`
      : `${ticker} — enter the percentage change:`,
    {
      reply_markup: { force_reply: true, input_field_placeholder: placeholder },
    },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_alert_value") return next();

  const raw = ctx.message.text.trim();
  const value = parseFloat(raw);

  if (isNaN(value) || value <= 0) {
    const isThreshold = ctx.session.pendingAlertType === "threshold";
    await ctx.reply(
      isThreshold
        ? "Please enter a valid price (e.g. 50000)."
        : "Please enter a valid percentage (e.g. 5).",
      {
        reply_markup: { force_reply: true, input_field_placeholder: isThreshold ? "Price" : "%" },
      },
    );
    return;
  }

  const ticker = ctx.session.pendingTicker;
  const direction = ctx.session.pendingAlertDirection;
  const alertType = ctx.session.pendingAlertType ?? "threshold";

  if (!ticker || !direction) {
    ctx.session.step = undefined;
    await ctx.reply("Something went wrong. Try again from the menu.");
    return;
  }

  const item = ctx.session.watchlist.find(
    (w: { ticker: string }) => w.ticker.toUpperCase() === ticker,
  );
  if (!item) {
    ctx.session.step = undefined;
    await ctx.reply(`${ticker} isn't on your watchlist. Add it first.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add coin", "add_coin:start")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  item.alerts.push({
    type: alertType as "threshold" | "percentage",
    direction: direction as "above" | "below" | "up" | "down" | "both",
    value,
    enabled: true,
  });

  ctx.session.step = undefined;
  ctx.session.pendingTicker = undefined;
  ctx.session.pendingAlertDirection = undefined;
  ctx.session.pendingAlertType = undefined;

  const dirLabel =
    direction === "above"
      ? "above"
      : direction === "below"
        ? "below"
        : direction === "up"
          ? "up"
          : direction === "down"
            ? "down"
            : "any direction";
  const typeLabel = alertType === "threshold" ? "Price" : "% move";

  await ctx.reply(
    `✅ ${ticker} alert set: ${typeLabel} ${dirLabel} ${value}${alertType === "percentage" ? "%" : ""}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🔔 Add another alert", `view_list:alerts:${ticker}`)],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

export default composer;
