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
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;
const WEB_APP_URL = "https://uc-hubuc-hub.onrender.com";
const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET || "uc_hub_secret";

const OWNER_ID = "6692410534";

app.use(express.json());
app.use(express.static(__dirname));


/* =========================
   🌐 WEBSITE
========================= */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "index.html")
  );

});


/* =========================
   🧩 OWNER KEYBOARD
========================= */

function ownerKeyboard() {

  return Markup.inlineKeyboard([

    [
      Markup.button.webApp(
        "🚀 فتح UC HUB",
        WEB_APP_URL
      )
    ],

    [
      Markup.button.callback(
        "📊 إحصائيات البوت",
        "BOT_STATS"
      )
    ],

    [
      Markup.button.callback(
        "🪙 إضافة 1000 نقطة",
        "ADD_1000"
      )
    ]

  ]);

}


/* =========================
   👤 NORMAL KEYBOARD
========================= */

function normalKeyboard() {

  return Markup.inlineKeyboard([

    [
      Markup.button.webApp(
        "🚀 فتح UC HUB",
        WEB_APP_URL
      )
    ]

  ]);

}


/* =========================
   🤖 START
========================= */

bot.start(async (ctx) => {

  const user = ctx.from;
  const userId = String(user.id);

  const data = loadData();

  const isNewUser =
    !data.users[userId];

  getUser(
    user.id,
    user.first_name || "User"
  );

  const payload =
    ctx.message.text.split(" ")[1];

  /* 🔗 Referral */

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


  /* 🚨 إشعار المستخدم الجديد */

  if (
    isNewUser &&
    userId !== OWNER_ID
  ) {

    const updated =
      loadData();

    const totalUsers =
      Object.keys(
        updated.users || {}
      ).length;

    try {

      await bot.telegram.sendMessage(

        OWNER_ID,

        "🚀🔥 مستخدم جديد دخل UC HUB!\n\n" +

        "👤 الاسم: " +
        (user.first_name || "غير معروف") +
        "\n" +

        "🆔 ID: " +
        user.id +
        "\n" +

        "🔗 Username: " +
        (
          user.username
            ? "@" + user.username
            : "لا يوجد"
        ) +
        "\n\n" +

        "👥 إجمالي المستخدمين: " +
        totalUsers +
        "\n\n" +

        "🎮 UC HUB"

      );

    } catch (error) {

      console.error(
        "Owner notification error:",
        error
      );

    }

  }


  /* 👑 رسالة المالك */

  if (userId === OWNER_ID) {

    await ctx.reply(

      "👑 أهلاً بك يا مالك UC HUB!\n\n" +
      "🎮 لوحة التحكم جاهزة.",

      ownerKeyboard()

    );

  } else {

    await ctx.reply(

      "🎮 أهلاً بك في UC HUB!\n\n" +
      "🪙 اجمع النقاط واستبدلها بالمكافآت.",

      normalKeyboard()

    );

  }

});


/* =========================
   📊 STATS FUNCTION
========================= */

async function sendStats(ctx) {

  if (
    String(ctx.from.id) !== OWNER_ID
  ) {

    return ctx.answerCbQuery(
      "❌ هذا الزر للمالك فقط."
    );

  }

  const data =
    loadData();

  const users =
    Object.values(
      data.users || {}
    );

  const orders =
    data.orders || [];

  const referrals =
    data.referrals || {};

  const totalUsers =
    users.length;

  const totalPoints =
    users.reduce(
      (sum, user) =>
        sum +
        Number(
          user.points || 0
        ),
      0
    );

  const totalReferrals =
    Object.keys(
      referrals
    ).length;

  const totalOrders =
    orders.length;

  const pendingOrders =
    orders.filter(
      o =>
        o.status ===
        "pending"
    ).length;

  const completedOrders =
    orders.filter(
      o =>
        o.status ===
        "completed"
    ).length;


  await ctx.answerCbQuery(
    "📊 تم تحديث الإحصائيات"
  );


  await ctx.reply(

    "📊🔥 إحصائيات UC HUB\n\n" +

    "👥 عدد المستخدمين:\n" +
    totalUsers +
    "\n\n" +

    "🪙 مجموع النقاط:\n" +
    totalPoints +
    "\n\n" +

    "🔗 إجمالي الإحالات:\n" +
    totalReferrals +
    "\n\n" +

    "📦 إجمالي الطلبات:\n" +
    totalOrders +
    "\n\n" +

    "⏳ قيد المعالجة:\n" +
    pendingOrders +
    "\n\n" +

    "✅ الطلبات المكتملة:\n" +
    completedOrders +
    "\n\n" +

    "🕐 آخر تحديث: الآن\n\n" +

    "🔥 UC HUB"

  );

}


/* =========================
   📊 STATS BUTTON
========================= */

bot.action(
  "BOT_STATS",
  async (ctx) => {

    try {

      await sendStats(ctx);

    } catch (error) {

      console.error(
        "Stats button error:",
        error
      );

      await ctx.answerCbQuery(
        "❌ حدث خطأ"
      );

    }

  }
);


/* =========================
   🪙 ADD 1000 BUTTON
========================= */

bot.action(
  "ADD_1000",
  async (ctx) => {

    if (
      String(ctx.from.id) !== OWNER_ID
    ) {

      return ctx.answerCbQuery(
        "❌ للمالك فقط."
      );

    }

    try {

      const data =
        loadData();

      const id =
        String(ctx.from.id);

      getUser(
        ctx.from.id,
        ctx.from.first_name ||
        "Owner"
      );

      const updated =
        loadData();

      updated.users[id].points += 1000;

      saveData(updated);

      await ctx.answerCbQuery(
        "🪙 تمت إضافة 1000 نقطة!"
      );

      await ctx.reply(

        "👑 تم إضافة 1000 نقطة بنجاح!\n\n" +

        "🪙 النقاط المضافة: +1000\n" +

        "💰 رصيدك الآن: " +
        updated.users[id].points +
        " نقطة"

      );

    } catch (error) {

      console.error(
        "Add points button error:",
        error
      );

      await ctx.answerCbQuery(
        "❌ حدث خطأ"
      );

    }

  }
);


/* =========================
   /stats
========================= */

bot.command(
  "stats",
  async (ctx) => {

    if (
      String(ctx.from.id) !== OWNER_ID
    ) {

      return ctx.reply(
        "❌ هذا الأمر مخصص للمالك."
      );

    }

    const data =
      loadData();

    const users =
      Object.values(
        data.users || {}
      );

    const orders =
      data.orders || [];

    const referrals =
      data.referrals || {};

    const totalUsers =
      users.length;

    const totalPoints =
      users.reduce(
        (sum, user) =>
          sum +
          Number(
            user.points || 0
          ),
        0
      );

    const totalReferrals =
      Object.keys(
        referrals
      ).length;

    const totalOrders =
      orders.length;

    const pendingOrders =
      orders.filter(
        o =>
          o.status ===
          "pending"
      ).length;

    const completedOrders =
      orders.filter(
        o =>
          o.status ===
          "completed"
      ).length;


    await ctx.reply(

      "📊🔥 إحصائيات UC HUB\n\n" +

      "👥 المستخدمون: " +
      totalUsers +
      "\n\n" +

      "🪙 مجموع النقاط: " +
      totalPoints +
      "\n\n" +

      "🔗 الإحالات: " +
      totalReferrals +
      "\n\n" +

      "📦 الطلبات: " +
      totalOrders +
      "\n\n" +

      "⏳ قيد المعالجة: " +
      pendingOrders +
      "\n\n" +

      "✅ المكتملة: " +
      completedOrders

    );

  }
);


/* =========================
   👤 USER API
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
   📦 ORDER API
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


/* =========================
   🔐 WEBHOOK
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
        "Webhook error:",
        error
      );

      res.sendStatus(500);

    }

  }
);


/* =========================
   🚀 SERVER
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
