const express = require("express");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const {
  getUser,
  addReferral,
  claimDailyReward,
  addStarsPurchase,
  createOrder,
  getOrders,
  loadData,
  saveData
} = require("./database");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;

const WEB_APP_URL =
  "https://uc-hubuc-hub.onrender.com";

const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET || "uc_hub_secret";

const CHANNEL_USERNAME =
  "@FREEUC_60";

const STAR_PACKAGES = {
  100: 50,
  200: 100,
  500: 250,
  1000: 500,
  2000: 1000
};

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

bot.start(async (ctx) => {

  const user = ctx.from;

  getUser(
    user.id,
    user.first_name || "User"
  );

  const payload =
    ctx.message.text.split(" ")[1];

  if (
    payload &&
    payload.startsWith("ref_")
  ) {
    addReferral(
      user.id,
      payload.replace("ref_", "")
    );
  }

  await ctx.reply(
    `🎮 أهلاً بك في UC HUB\n\n` +
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

app.get(
  "/api/user/:id",
  (req, res) => {

    const user =
      getUser(req.params.id);

    res.json({
      id: user.id,
      firstName: user.firstName,
      points: user.points,
      referrals: user.referrals
    });
  }
);

app.post(
  "/api/rewards/daily",
  (req, res) => {

    const userId =
      req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "المستخدم غير معروف"
      });
    }

    res.json(
      claimDailyReward(userId)
    );
  }
);

app.get(
  "/api/rewards/channel",
  async (req, res) => {

    try {

      const userId =
        Number(req.query.userId);

      if (!userId) {
        return res.json({
          success: false,
          message: "المستخدم غير معروف"
        });
      }

      const member =
        await bot.telegram.getChatMember(
          CHANNEL_USERNAME,
          userId
        );

      const allowed = [
        "creator",
        "administrator",
        "member"
      ];

      if (!allowed.includes(member.status)) {
        return res.json({
          success: false,
          joined: false,
          message:
            "انضم إلى القناة أولاً 📢"
        });
      }

      const data = loadData();

      const user =
        data.users[String(userId)];

      if (!user) {
        return res.json({
          success: false
        });
      }

      if (user.channelRewardClaimed) {
        return res.json({
          success: false,
          joined: true,
          alreadyClaimed: true,
          message:
            "أخذت مكافأة القناة مسبقاً 🎁"
        });
      }

      user.points += 1;

      user.channelRewardClaimed = true;

      saveData(data);

      res.json({
        success: true,
        joined: true,
        points: 1,
        balance: user.points
      });

    } catch (error) {

      console.error(
        "Channel check:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "البوت يجب أن يكون موجوداً في القناة"
      });
    }
  }
);

app.get(
  "/api/orders/:userId",
  (req, res) => {

    res.json(
      getOrders(req.params.userId)
    );
  }
);

app.post(
  "/api/order",
  (req, res) => {

    const {
      userId,
      uc,
      cost,
      playerId
    } = req.body;

    if (
      !userId ||
      !uc ||
      !cost ||
      !playerId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "بيانات الطلب ناقصة"
      });
    }

    res.json(
      createOrder(
        userId,
        Number(uc),
        Number(cost),
        String(playerId)
      )
    );
  }
);

app.post(
  "/api/stars/invoice",
  async (req, res) => {

    try {

      const stars =
        Number(req.body.stars);

      const points =
        STAR_PACKAGES[stars];

      if (!points) {
        return res.status(400).json({
          success: false,
          message:
            "باقة غير صحيحة"
        });
      }

      const invoiceLink =
        await bot.telegram.callApi(
          "createInvoiceLink",
          {
            title:
              `${points} نقطة`,

            description:
              `شراء ${points} نقطة`,

            payload:
              `stars_${stars}_${points}`,

            currency: "XTR",

            prices: [
              {
                label:
                  `${points} نقطة`,
                amount: stars
              }
            ]
          }
        );

      res.json({
        success: true,
        invoiceLink
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message:
          "تعذر إنشاء الفاتورة"
      });
    }
  }
);

bot.on(
  "pre_checkout_query",
  async (ctx) => {

    const query =
      ctx.update.pre_checkout_query;

    const match =
      query.invoice_payload.match(
        /^stars_(\d+)_(\d+)$/
      );

    if (!match) {
      return ctx.answerPreCheckoutQuery(
        false,
        "فاتورة غير صالحة"
      );
    }

    const stars =
      Number(match[1]);

    const points =
      Number(match[2]);

    if (
      STAR_PACKAGES[stars] !== points ||
      query.currency !== "XTR" ||
      Number(query.total_amount) !== stars
    ) {
      return ctx.answerPreCheckoutQuery(
        false,
        "بيانات الدفع غير صحيحة"
      );
    }

    await ctx.answerPreCheckoutQuery(
      true
    );
  }
);

bot.on(
  "message",
  async (ctx) => {

    const payment =
      ctx.message.successful_payment;

    if (!payment) return;

    const match =
      payment.invoice_payload.match(
        /^stars_(\d+)_(\d+)$/
      );

    if (!match) return;

    const stars =
      Number(match[1]);

    const points =
      Number(match[2]);

    if (
      payment.currency !== "XTR" ||
      STAR_PACKAGES[stars] !== points ||
      Number(payment.total_amount) !== stars
    ) {
      return;
    }

    const result =
      addStarsPurchase(
        ctx.from.id,
        stars,
        points,
        payment.telegram_payment_charge_id
      );

    if (result.success) {

      await ctx.reply(
        `🎉 تم الدفع بنجاح!\n\n` +
        `⭐ ${stars} Stars\n` +
        `🪙 +${points} نقطة\n\n` +
        `💰 رصيدك: ${result.newBalance} نقطة`
      );
    }
  }
);

app.post(
  `/telegram/${WEBHOOK_SECRET}`,
  async (req, res) => {

    try {

      await bot.handleUpdate(
        req.body
      );

      res.sendStatus(200);

    } catch (error) {

      console.error(error);

      res.sendStatus(500);
    }
  }
);

app.listen(
  PORT,
  async () => {

    console.log(
      `UC HUB server running on port ${PORT}`
    );

    try {

      await bot.telegram.setWebhook(
        `https://uc-hubuc-hub.onrender.com/telegram/${WEBHOOK_SECRET}`
      );

      console.log(
        "Telegram webhook enabled 🚀"
      );

    } catch (error) {

      console.error(
        "Webhook setup failed:",
        error
      );
    }
  }
);
