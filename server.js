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
const CHANNEL = "@FREEUC_60";

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
   🔐 CHECK CHANNEL
========================= */

async function isSubscribed(userId) {

  try {

    const member =
      await bot.telegram.getChatMember(
        CHANNEL,
        userId
      );

    return [
      "creator",
      "administrator",
      "member"
    ].includes(member.status);

  } catch (error) {

    console.error(
      "Channel check error:",
      error.message
    );

    return false;

  }

}


/* =========================
   📢 JOIN MESSAGE
========================= */

async function requireSubscription(ctx) {

  await ctx.reply(

    "🔒 يجب الاشتراك في قناة UC HUB أولاً\n\n" +

    "📢 اشترك في القناة حتى تتمكن من استخدام البوت.\n\n" +

    "بعد الاشتراك اضغط على «✅ تحقق من الاشتراك».",

    Markup.inlineKeyboard([

      [
        Markup.button.url(
          "📢 الاشتراك في القناة",
          "https://t.me/FREEUC_60"
        )
      ],

      [
        Markup.button.callback(
          "✅ تحقق من الاشتراك",
          "CHECK_SUB"
        )
      ]

    ])

  );

}


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

  /* 👑 المالك يتجاوز الاشتراك */

  if (userId !== OWNER_ID) {

    const subscribed =
      await isSubscribed(user.id);

    if (!subscribed) {

      return requireSubscription(ctx);

    }

  }


  const data = loadData();

  const isNewUser =
    !data.users[userId];

  getUser(
    user.id,
    user.first_name || "User"
  );


  /* 🔗 Referral */

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


  /* 👑 المالك */

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
   ✅ CHECK SUB BUTTON
========================= */

bot.action(
  "CHECK_SUB",
  async (ctx) => {

    try {

      const userId =
        ctx.from.id;

      const subscribed =
        await isSubscribed(
          userId
        );

      if (!subscribed) {

        await ctx.answerCbQuery(
          "❌ لم يتم العثور على اشتراكك.",
          {
            show_alert: true
          }
        );

        return;

      }


      await ctx.answerCbQuery(
        "✅ تم التحقق من اشتراكك!"
      );


      const user =
        getUser(
          userId,
          ctx.from.first_name ||
          "User"
        );


      await ctx.reply(

        "🎉 تم التحقق بنجاح!\n\n" +

        "✅ أنت مشترك في القناة.\n" +

        "🪙 رصيدك الحالي: " +
        user.points +
        " نقطة\n\n" +

        "🚀 الآن يمكنك الدخول إلى UC HUB.",

        normalKeyboard()

      );

    } catch (error) {

      console.error(
        "Subscription button error:",
        error
      );

      await ctx.answerCbQuery(
        "❌ حدث خطأ أثناء التحقق.",
        {
          show_alert: true
        }
      );

    }

  }
);


/* =========================
   📊 STATS
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

  let subscribedCount = 0;

  for (const user of users) {

    try {

      if (
        await isSubscribed(
          Number(user.id)
        )
      ) {

        subscribedCount++;

      }

    } catch {}

  }


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

    "👥 إجمالي المستخدمين: " +
    totalUsers +
    "\n\n" +

    "📢 المشتركين بالقناة: " +
    subscribedCount +
    "\n\n" +

    "❌ غير المشتركين: " +
    (
      totalUsers -
      subscribedCount
    ) +
    "\n\n" +

    "🪙 مجموع النقاط: " +
    totalPoints +
    "\n\n" +

    "🔗 إجمالي الإحالات: " +
    totalReferrals +
    "\n\n" +

    "📦 إجمالي الطلبات: " +
    totalOrders +
    "\n\n" +

    "⏳ قيد المعالجة: " +
    pendingOrders +
    "\n\n" +

    "✅ المكتملة: " +
    completedOrders +
    "\n\n" +

    "🕐 آخر تحديث: الآن\n\n" +

    "🔥 UC HUB"

  );

}


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
   🪙 ADD 1000
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

      getUser(
        ctx.from.id,
        ctx.from.first_name ||
        "Owner"
      );

      const data =
        loadData();

      const id =
        String(ctx.from.id);

      data.users[id].points += 1000;

      saveData(data);


      await ctx.answerCbQuery(
        "🪙 تمت إضافة 1000 نقطة!"
      );


      await ctx.reply(

        "👑 تم إضافة 1000 نقطة بنجاح!\n\n" +

        "🪙 النقاط المضافة: +1000\n\n" +

        "💰 رصيدك الآن: " +
        data.users[id].points +
        " نقطة"

      );

    } catch (error) {

      console.error(
        "Add points error:",
        error
      );

      await ctx.answerCbQuery(
        "❌ حدث خطأ"
      );

    }

  }
);


/* =========================
   📊 /stats
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

    await ctx.reply(

      "📊🔥 إحصائيات UC HUB\n\n" +

      "👥 المستخدمون: " +
      totalUsers +
      "\n\n" +

      "🪙 مجموع النقاط: " +
      totalPoints +
      "\n\n" +

      "📦 الطلبات: " +
      orders.length

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
