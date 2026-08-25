const express = require("express");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const {
  getUser,
  addReferral,
  createOrder
} = require("./database");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;
const WEB_APP_URL = "https://uc-hubuc-hub.onrender.com";;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "uc_hub_secret";

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

    addReferral(user.id, referrerId);
  }

  await ctx.reply(
    `🎮 أهلاً بك في UC HUB\n\n` +
    `🪙 اجمع النقاط واستبدلها بالمكافآت!`,
    WEB_APP_URL
      ? Markup.inlineKeyboard([
          [
            Markup.button.webApp(
              "🚀 فتح UC HUB",
              WEB_APP_URL
            )
          ]
        ])
      : undefined
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

app.post(
  `/telegram/${WEBHOOK_SECRET}`,
  async (req, res) => {
    try {
      await bot.handleUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  }
);

app.listen(PORT, async () => {
  console.log(
    `UC HUB server running on port ${PORT}`
  );

  try {
    await bot.telegram.setWebhook(
      `https://uc-hubuc-hub.onrender.com/telegram/${WEBHOOK_SECRET}`
    );

    console.log("Telegram webhook enabled 🚀");
  } catch (error) {
    console.error(
      "Webhook setup failed:",
      error
    );
  }
});
