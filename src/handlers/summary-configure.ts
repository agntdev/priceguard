import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { SUMMARY_TIMES } from "../lib/clock.js";
import { recordUserInteraction } from "../lib/metrics-store.js";

registerMainMenuItem({ label: "☀️ Summary", data: "summary:configure", order: 40 });

const composer = new Composer<Ctx>();

composer.callbackQuery("summary:configure", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.from) return;
  recordUserInteraction(ctx.from.id, Date.now());

  const current = ctx.session.summaryTime;

  const rows = SUMMARY_TIMES.map((t) => [
    inlineButton(
      `${t.label}${current === t.value ? " ✓" : ""}`,
      `summary:set:${t.value}`,
    ),
  ]);

  await ctx.reply(
    current
      ? `Daily summary is set for ${current}. Pick a new time or disable:`
      : "Choose a time for your daily price summary:",
    {
      reply_markup: inlineKeyboard([
        ...rows,
        ...(current ? [[inlineButton("🔕 Disable summary", "summary:disable")]] : []),
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^summary:set:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const time = ctx.match[1];
  ctx.session.summaryTime = time;
  await ctx.reply(`Morning summary set for ${time} (${ctx.session.timezone ?? "UTC"}).`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("summary:disable", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.summaryTime = undefined;
  await ctx.reply("Morning summary disabled.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
