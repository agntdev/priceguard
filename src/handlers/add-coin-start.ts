import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { resolveCoinByTicker, getCoinPrice, POPULAR_COINS } from "../lib/api.js";
import { recordUserInteraction } from "../lib/metrics-store.js";

registerMainMenuItem({ label: "➕ Add coin", data: "add_coin:start", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("add_coin:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  recordUserInteraction(ctx.from.id, Date.now());

  const keyboard = inlineKeyboard([
    ...POPULAR_COINS.map((c) => [
      inlineButton(`${c.ticker}`, `add_coin:pick:${c.ticker}`),
    ]),
    [inlineButton("Type a ticker…", "add_coin:type")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  await ctx.reply("Pick a coin or type any ticker symbol:", {
    reply_markup: keyboard,
  });
});

composer.callbackQuery(/^add_coin:pick:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  await handleCoinResolution(ctx, ticker);
});

composer.callbackQuery("add_coin:type", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_ticker";
  await ctx.reply("Type a ticker symbol (e.g. BTC, ETH, SOL):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Ticker symbol…" },
  });
});

composer.callbackQuery(/^add_coin:confirm:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  const existing = ctx.session.watchlist.find(
    (w) => w.ticker.toUpperCase() === ticker,
  );
  if (existing) {
    await ctx.editMessageText(`${ticker} is already on your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  ctx.session.watchlist.push({
    ticker,
    name: ctx.session.pendingCoinName ?? ticker,
    alerts: [],
    enabled: true,
  });

  await ctx.editMessageText(`${ticker} added to your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add another", "add_coin:start")],
      [inlineButton("📋 View watchlist", "view_list:show")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("add_coin:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  ctx.session.pendingTicker = undefined;
  await ctx.editMessageText("Cancelled.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_ticker") return next();
  const ticker = ctx.message.text.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (ticker.length === 0 || ticker.length > 10) {
    await ctx.reply("That doesn't look like a valid ticker. Try again:", {
      reply_markup: { force_reply: true, input_field_placeholder: "Ticker symbol…" },
    });
    return;
  }
  ctx.session.step = undefined;
  await handleCoinResolution(ctx, ticker);
});

async function handleCoinResolution(ctx: Ctx, ticker: string) {
  const existing = ctx.session.watchlist.find(
    (w) => w.ticker.toUpperCase() === ticker,
  );
  if (existing) {
    await ctx.reply(`${ticker} is already on your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const coin = await resolveCoinByTicker(ticker);
  if (!coin) {
    await ctx.reply(`Couldn't find a coin matching "${ticker}". Check the spelling and try again.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Try again", "add_coin:start")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const currency = ctx.session.currency ?? "usd";
  const priceData = await getCoinPrice(coin.id, currency);
  const symbol = currency.toUpperCase();
  const priceText = priceData
    ? ` — ${priceData.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`
    : "";

  ctx.session.pendingTicker = coin.symbol.toUpperCase();
  ctx.session.pendingCoinName = coin.name;

  await ctx.reply(
    `${coin.name} (${coin.symbol.toUpperCase()})${priceText}\n\nAdd ${coin.symbol.toUpperCase()} to your watchlist?`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Add", `add_coin:confirm:${coin.symbol.toUpperCase()}`)],
        [inlineButton("Cancel", "add_coin:cancel")],
      ]),
    },
  );
}

export default composer;
