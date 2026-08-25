const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;
const WEB_APP_URL = process.env.WEB_APP_URL;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("UC HUB is online 🚀");
});

bot.start(async (ctx) => {
  const username = ctx.from.first_name || "صديقي";

  if (!WEB_APP_URL) {
    return ctx.reply(
      `أهلاً ${username} 👋\n\nUC HUB قيد التجهيز 🔥`
    );
  }

  await ctx.reply(
    `أهلاً ${username} 👋\n\n` +
    `🎮 أهلاً بك في UC HUB\n` +
    `🪙 اجمع النقاط واستبدلها بالمكافآت!`,
    Markup.inlineKeyboard([
      [
        Markup.button.webApp(
          "🚀 فتح UC HUB",
          WEB_APP_URL
        )
      ]
    ])
  );
});

bot.command("help", (ctx) => {
  ctx.reply(
    "🎮 UC HUB\n\n" +
    "🪙 اجمع النقاط\n" +
    "🔗 ادعُ أصدقاءك\n" +
    "🎁 استبدل نقاطك بالمكافآت"
  );
});

bot.catch((err) => {
  console.error("Telegram bot error:", err);
});

app.listen(PORT, () => {
  console.log(`UC HUB server running on port ${PORT}`);
});

bot.launch()
  .then(() => {
    console.log("UC HUB Telegram bot started 🚀");
  })
  .catch((err) => {
    console.error("Bot failed to start:", err);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
