const express = require("express");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const {
  getUser,
  addReferral,
  addStarsPurchase,
  createOrder
} = require("./database");

const app = express();

const bot =
  new Telegraf(
    process.env.BOT_TOKEN
  );

const PORT =
  process.env.PORT || 3000;

const WEB_APP_URL =
  "https://uc-hubuc-hub.onrender.com";

const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ||
  "uc_hub_secret";

/*
  Telegram Stars packages

  100 ⭐  = 50 points
  200 ⭐  = 100 points
  500 ⭐  = 250 points
  1000 ⭐ = 500 points
  2000 ⭐ = 1000 points
*/

const STAR_PACKAGES = {
  100: 50,
  200: 100,
  500: 250,
  1000: 500,
  2000: 1000
};

app.use(
  express.json()
);

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

/* =========================
   START BOT
========================= */

bot.start(async (ctx) => {

  const user =
    ctx.from;

  getUser(
    user.id,
    user.first_name ||
    "User"
  );

  const payload =
    ctx.message.text
      .split(" ")[1];

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

/* =========================
   USER API
========================= */

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

/* =========================
   CREATE UC ORDER
========================= */

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

      return res.status(400)
        .json({

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

/* =========================
   CREATE TELEGRAM STARS
   INVOICE
========================= */

app.post(
  "/api/stars/invoice",
  async (req, res) => {

    try {

      const stars =
        Number(
          req.body.stars
        );

      const points =
        STAR_PACKAGES[stars];

      if (!points) {

        return res.status(400)
          .json({

            success: false,

            message:
              "باقة Stars غير صحيحة"

          });

      }

      /*
        Payload داخلي للبوت.
        لا نعتمد على النقاط القادمة من التطبيق.
      */

      const payload =
        `stars_${stars}_${points}`;

      const invoiceLink =
        await bot.telegram.callApi(
          "createInvoiceLink",
          {
            title:
              `🪙 ${points} نقطة`,

            description:
              `شراء ${points} نقطة مقابل ${stars} Telegram Stars`,

            payload,

            currency: "XTR",

            prices: [
              {
                label:
                  `${points} نقطة`,

                amount:
                  stars
              }
            ]
          }
        );

      res.json({

        success: true,

        invoiceLink,

        stars,

        points

      });

    } catch (error) {

      console.error(
        "Invoice creation error:",
        error
      );

      res.status(500)
        .json({

          success: false,

          message:
            "تعذر إنشاء فاتورة الدفع"

        });

    }

  }
);

/* =========================
   PRE-CHECKOUT
========================= */

bot.on(
  "pre_checkout_query",
  async (ctx) => {

    try {

      const query =
        ctx.update
          .pre_checkout_query;

      const payload =
        query.invoice_payload;

      const match =
        payload.match(
          /^stars_(\d+)_(\d+)$/
        );

      if (!match) {

        await ctx.answerPreCheckoutQuery(
          false,
          "فاتورة غير صالحة"
        );

        return;
      }

      const stars =
        Number(match[1]);

      const points =
        Number(match[2]);

      const expectedPoints =
        STAR_PACKAGES[stars];

      if (
        !expectedPoints ||
        expectedPoints !== points ||
        query.currency !== "XTR" ||
        Number(query.total_amount) !== stars
      ) {

        await ctx.answerPreCheckoutQuery(
          false,
          "بيانات الدفع غير صحيحة"
        );

        return;
      }

      await ctx.answerPreCheckoutQuery(
        true
      );

    } catch (error) {

      console.error(
        "Pre-checkout error:",
        error
      );

      try {

        await ctx.answerPreCheckoutQuery(
          false,
          "حدث خطأ أثناء التحقق من الدفع"
        );

      } catch {}

    }

  }
);

/* =========================
   SUCCESSFUL PAYMENT
========================= */

bot.on(
  "message",
  async (ctx) => {

    const payment =
      ctx.message
        .successful_payment;

    if (!payment) {
      return;
    }

    try {

      if (
        payment.currency !== "XTR"
      ) {

        return;
      }

      const payload =
        payment.invoice_payload;

      const match =
        payload.match(
          /^stars_(\d+)_(\d+)$/
        );

      if (!match) {
        return;
      }

      const stars =
        Number(match[1]);

      const points =
        Number(match[2]);

      const expectedPoints =
        STAR_PACKAGES[stars];

      if (
        !expectedPoints ||
        expectedPoints !== points ||
        Number(payment.total_amount) !== stars
      ) {

        console.error(
          "Invalid successful payment:",
          payment
        );

        return;
      }

      const result =
        addStarsPurchase(

          ctx.from.id,

          stars,

          points,

          payment.telegram_payment_charge_id

        );

      if (
        result.success
      ) {

        await ctx.reply(

          `🎉 تم الدفع بنجاح!\n\n` +

          `⭐ دفعت: ${stars} Stars\n` +

          `🪙 تمت إضافة: ${points} نقطة\n\n` +

          `💰 رصيدك الجديد: ${result.newBalance} نقطة`

        );

      } else if (
        result.duplicate
      ) {

        console.log(
          "Duplicate payment ignored:",
          payment.telegram_payment_charge_id
        );

      }

    } catch (error) {

      console.error(
        "Successful payment error:",
        error
      );

    }

  }
);

/* =========================
   WEBHOOK
========================= */

app.post(
  `/telegram/${WEBHOOK_SECRET}`,
  async (req, res) => {

    try {

      await bot.handleUpdate(
        req.body
      );

      res.sendStatus(200);

    } catch (error) {

      console.error(
        error
      );

      res.sendStatus(500);

    }

  }
);

/* =========================
   START SERVER
========================= */

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
