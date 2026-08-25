const express = require("express");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const {
  getUser,
  addReferral,
  getPoints,
  createOrder
} = require("./database");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;
const WEB_APP_URL = process.env.WEB_APP_URL;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

bot.start(async (ctx) => {
  const user = ctx.from;

  getUser(
    user.id,
    user.first_name || "User"
  );

  const payload = ctx.message.text.split(" ")[1];

  if (payload && payload.startsWith("ref_")) {
    const referrerId = payload.replace("ref_", "");

    addReferral(
      user.id,
      referrerId
    );
  }

  if (!WEB_APP_URL) {
    return ctx.reply(
      `أهلاً ${user.first_name || "صديقي"} 👋\n\nUC HUB قيد التجهيز 🔥`
    );
  }

  await ctx.reply(
    `🎮 أهلاً بك في UC HUB\n\n` +
    `🪙 اجمع النقاط من الإحالات واستبدلها بالمكافآت!`,
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

app.get("/api/user/:id", (req, res) => {
  const user = getUser(req.params.id);

  res.json({
    id: user.id,
    firstName: user.firstName,
    points: user.points,
    referrals: user.referrals
  });
});

app.post("/api/order", (req, res) => {
  const {
    userId,
    uc,
    cost,
    playerId
  } = req.body;

  if (!userId || !uc || !cost || !playerId) {
    return res.status(400).json({
      success: false,
      message: "بيانات الطلب ناقصة"
    });
  }

  const result = createOrder(
    userId,
    Number(uc),
    Number(cost),
    String(playerId)
  );

  res.json(result);
});

app.listen(PORT, () => {
  console.log(
    `UC HUB server running on port ${PORT}`
  );
});

bot.launch()
  .then(() => {
    console.log(
      "UC HUB Telegram bot started 🚀"
    );
  })
  .catch((err) => {
    console.error(
      "Bot failed to start:",
      err
    );
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
