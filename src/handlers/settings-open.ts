import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  COMMON_TIMEZONES,
  CURRENCIES,
  parseTimezone,
  formatTime,
  isQuietHours,
} from "../lib/clock.js";
import { recordUserInteraction } from "../lib/metrics-store.js";

registerMainMenuItem({ label: "⚙️ Settings", data: "settings:open", order: 60 });

const composer = new Composer<Ctx>();

function settingsMenu(): { text: string; keyboard: ReturnType<typeof inlineKeyboard> } {
  return {
    text: "Your settings:",
    keyboard: inlineKeyboard([
      [inlineButton("🌍 Timezone", "settings:timezone")],
      [inlineButton("💱 Currency", "settings:currency")],
      [inlineButton("🔇 Quiet hours", "settings:quiet")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  };
}

composer.callbackQuery("settings:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  recordUserInteraction(ctx.from.id, Date.now());

  const { text, keyboard } = settingsMenu();
  const tz = ctx.session.timezone ?? "UTC";
  const curr = (ctx.session.currency ?? "usd").toUpperCase();
  const quiet = `${ctx.session.quietHoursStart ?? "23:00"}–${ctx.session.quietHoursEnd ?? "07:00"}`;
  const cooldown = ctx.session.cooldownHours ?? 4;
  const summary = ctx.session.summaryTime ?? "not set";

  await ctx.reply(
    `Your settings:\n\n` +
      `🌍 Timezone: ${tz}\n` +
      `💱 Currency: ${curr}\n` +
      `🔇 Quiet hours: ${quiet}\n` +
      `⏱ Alert cooldown: ${cooldown}h\n` +
      `☀️ Morning summary: ${summary}`,
    { reply_markup: keyboard },
  );
});

// Timezone
composer.callbackQuery("settings:timezone", async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = COMMON_TIMEZONES.map((tz) => [
    inlineButton(tz.label, `settings:set_tz:${tz.value}`),
  ]);
  await ctx.reply("Pick your timezone:", {
    reply_markup: inlineKeyboard([
      ...rows,
      [inlineButton("⬅️ Back", "settings:open")],
    ]),
  });
});

composer.callbackQuery(/^settings:set_tz:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const tz = ctx.match[1];
  if (!parseTimezone(tz)) {
    await ctx.reply("That timezone isn't recognized. Try another.", {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Try again", "settings:timezone")],
        [inlineButton("⬅️ Back", "settings:open")],
      ]),
    });
    return;
  }
  ctx.session.timezone = tz;
  await ctx.reply(`Timezone set to ${tz}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to settings", "settings:open")],
    ]),
  });
});

// Currency
composer.callbackQuery("settings:currency", async (ctx) => {
  await ctx.answerCallbackQuery();
  const rows = CURRENCIES.map((c) => [
    inlineButton(c.label, `settings:set_curr:${c.value}`),
  ]);
  await ctx.reply("Pick your preferred currency:", {
    reply_markup: inlineKeyboard([
      ...rows,
      [inlineButton("⬅️ Back", "settings:open")],
    ]),
  });
});

composer.callbackQuery(/^settings:set_curr:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const curr = ctx.match[1];
  ctx.session.currency = curr;
  await ctx.reply(`Currency set to ${curr.toUpperCase()}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to settings", "settings:open")],
    ]),
  });
});

// Quiet hours
composer.callbackQuery("settings:quiet", async (ctx) => {
  await ctx.answerCallbackQuery();
  const start = ctx.session.quietHoursStart ?? "23:00";
  const end = ctx.session.quietHoursEnd ?? "07:00";
  await ctx.reply(
    `Quiet hours: ${start}–${end}\n\nAlerts are suppressed during quiet hours.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Change start", "settings:quiet_start")],
        [inlineButton("Change end", "settings:quiet_end")],
        [inlineButton("⬅️ Back", "settings:open")],
      ]),
    },
  );
});

composer.callbackQuery("settings:quiet_start", async (ctx) => {
  await ctx.answerCallbackQuery();
  const options = ["21:00", "22:00", "23:00", "00:00"];
  const rows = options.map((t) => [
    inlineButton(t, `settings:set_qstart:${t}`),
  ]);
  await ctx.reply("When should quiet hours start?", {
    reply_markup: inlineKeyboard([
      ...rows,
      [inlineButton("⬅️ Back", "settings:quiet")],
    ]),
  });
});

composer.callbackQuery(/^settings:set_qstart:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.quietHoursStart = ctx.match[1];
  await ctx.reply(`Quiet hours start set to ${ctx.match[1]}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to settings", "settings:open")],
    ]),
  });
});

composer.callbackQuery("settings:quiet_end", async (ctx) => {
  await ctx.answerCallbackQuery();
  const options = ["05:00", "06:00", "07:00", "08:00"];
  const rows = options.map((t) => [
    inlineButton(t, `settings:set_qend:${t}`),
  ]);
  await ctx.reply("When should quiet hours end?", {
    reply_markup: inlineKeyboard([
      ...rows,
      [inlineButton("⬅️ Back", "settings:quiet")],
    ]),
  });
});

composer.callbackQuery(/^settings:set_qend:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.quietHoursEnd = ctx.match[1];
  await ctx.reply(`Quiet hours end set to ${ctx.match[1]}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to settings", "settings:open")],
    ]),
  });
});

export default composer;
