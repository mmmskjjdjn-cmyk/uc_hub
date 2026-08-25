const express = require("express");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const {
  getUser,
  addReferral,
  createOrder,
  loadData,
  saveData
} = require("./database");

const app = express();

const bot = new Telegraf(
  process.env.BOT_TOKEN
);

const PORT =
  process.env.PORT || 3000;

const WEB_APP_URL =
  "https://uc-hubuc-hub.onrender.com";

const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ||
  "uc_hub_secret";

/* 👑 Telegram ID الخاص بالمالك */
const OWNER_ID = "6692410534";

app.use(express.json());

app.use(
  express.static(__dirname)
);

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

});


/* 🤖 تشغيل البوت */

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

    const referrerId =
      payload.replace(
        "ref_",
        ""
      );

    addReferral(
      user.id,
      referrerId
    );

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


/* 👑 أمر المالك لإضافة 1000 نقطة */

bot.command(
  "add1000",
  async (ctx) => {

    if (
      String(ctx.from.id) !==
      OWNER_ID
    ) {

      return ctx.reply(
        "❌ هذا الأمر مخصص لمالك البوت فقط."
      );

    }

    try {

      const user =
        getUser(
          ctx.from.id,
          ctx.from.first_name ||
          "Owner"
        );

      const data =
        loadData();

      const id =
        String(ctx.from.id);

      if (!data.users[id]) {

        data.users[id] = {
          id,
          firstName:
            ctx.from.first_name ||
            "Owner",
          points: 0,
          referrals: 0,
          createdAt:
            new Date().toISOString()
        };

      }

      data.users[id].points += 1000;

      saveData(data);

      await ctx.reply(

        "👑 تم تنفيذ أمر المالك بنجاح!\n\n" +

        "🪙 تمت إضافة: +1000 نقطة\n" +

        "💰 رصيدك الآن: " +
        data.users[id].points +
        " نقطة\n\n" +

        "🔥 UC HUB"

      );

    } catch (error) {

      console.error(
        "Add points error:",
        error
      );

      await ctx.reply(
        "❌ حدث خطأ أثناء إضافة النقاط."
      );

    }

  }
);


/* 👤 بيانات المستخدم */

app.get(
  "/api/user/:id",
  (req, res) => {

    const user =
      getUser(
        req.params.id
      );

    res.json({

      id: user.id,

      firstName:
        user.firstName,

      points:
        user.points,

      referrals:
        user.referrals

    });

  }
);


/* 📦 إنشاء طلب UC */

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
      cost === undefined ||
      !playerId
    ) {

      return res.status(400).json({

        success: false,

        message:
          "بيانات الطلب ناقصة"

      });

    }

    const result =
      createOrder(

        userId,

        Number(uc),

        Number(cost),

        String(playerId)

      );

    res.json(result);

  }
);


/* 🔐 Telegram Webhook */

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


/* 🚀 تشغيل السيرفر */

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
