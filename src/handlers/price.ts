import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getCoinPrice, getMultiplePrices, resolveCoinByTicker } from "../lib/api.js";
import { recordUserInteraction } from "../lib/metrics-store.js";

const composer = new Composer<Ctx>();

composer.command("price", async (ctx) => {
  if (!ctx.from) return;
  recordUserInteraction(ctx.from.id, Date.now());

  const arg = (ctx.message?.text ?? "").replace(/^\/price\s*/i, "").trim().toUpperCase();
  const currency = ctx.session.currency ?? "usd";
  const symbol = currency.toUpperCase();

  if (arg) {
    const coin = await resolveCoinByTicker(arg);
    if (!coin) {
      await ctx.reply(`Couldn't find a coin matching "${arg}". Check the spelling and try again.`, {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
      return;
    }

    const price = await getCoinPrice(coin.id, currency);
    if (!price) {
      await ctx.reply("Couldn't fetch the price right now. Try again in a moment.", {
        reply_markup: inlineKeyboard([
          [inlineButton("🔄 Retry", `price:retry:${arg}`)],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      });
      return;
    }

    const changeIcon = price.change24h >= 0 ? "📈" : "📉";
    const changeSign = price.change24h >= 0 ? "+" : "";
    await ctx.reply(
      `${coin.name} (${coin.symbol.toUpperCase()})\n` +
        `Price: ${price.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}\n` +
        `${changeIcon} 24h: ${changeSign}${price.change24h.toFixed(2)}%`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("🔄 Refresh", `price:retry:${arg}`)],
          [inlineButton("➕ Add to watchlist", `add_coin:pick:${coin.symbol.toUpperCase()}`)],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  if (ctx.session.watchlist.length === 0) {
    await ctx.reply("Your watchlist is empty — add some coins first.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add coin", "add_coin:start")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const coinIds = ctx.session.watchlist.map((w) => w.ticker.toLowerCase());
  const prices = await getMultiplePrices(coinIds, currency);

  const lines: string[] = [];
  for (const item of ctx.session.watchlist) {
    const id = item.ticker.toLowerCase();
    const price = prices.get(id);
    if (price) {
      const changeSign = price.change24h >= 0 ? "+" : "";
      const icon = price.change24h >= 0 ? "📈" : "📉";
      lines.push(
        `${item.ticker} — ${price.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol} ${icon}${changeSign}${price.change24h.toFixed(2)}%`,
      );
    } else {
      lines.push(`${item.ticker} — price unavailable`);
    }
  }

  await ctx.reply(
    `Watchlist prices:\n\n${lines.join("\n")}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Refresh", "price:refresh_all")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^price:retry:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match[1].toUpperCase();
  const currency = ctx.session.currency ?? "usd";
  const symbol = currency.toUpperCase();

  const coin = await resolveCoinByTicker(ticker);
  if (!coin) {
    await ctx.reply(`Couldn't find a coin matching "${ticker}".`);
    return;
  }

  const price = await getCoinPrice(coin.id, currency);
  if (!price) {
    await ctx.reply("Still can't fetch the price. Try again later.");
    return;
  }

  const changeIcon = price.change24h >= 0 ? "📈" : "📉";
  const changeSign = price.change24h >= 0 ? "+" : "";
  await ctx.reply(
    `${coin.name} (${coin.symbol.toUpperCase()})\n` +
      `Price: ${price.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}\n` +
      `${changeIcon} 24h: ${changeSign}${price.change24h.toFixed(2)}%`,
  );
});

export default composer;
