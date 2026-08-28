const express = require("express");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");

const {
  getUser,
  addReferral,
  createOrder,
  loadData,
  claimDailyReward,
  getOrders
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

const OWNER_ID =
  "6692410534";

const CHANNEL =
  "@FREEUC_60";


app.use(express.json());

app.use(
  express.static(__dirname)
);


/* =========================
   🌐 WEBSITE
========================= */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

});


/* =========================
   🔐 CHANNEL CHECK
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
    ].includes(
      member.status
    );

  } catch (error) {

    console.error(
      "Channel check error:",
      error.message
    );

    return false;

  }

}


/* =========================
   📢 REQUIRE SUBSCRIPTION
========================= */

async function requireSubscription(ctx) {

  await ctx.reply(

    "🔒 الاشتراك مطلوب\n\n" +

    "حتى تستخدم UC HUB لازم تشترك " +
    "في القناة أولاً.\n\n" +

    "📢 اشترك ثم اضغط تحقق 👇",

    Markup.inlineKeyboard([

      [
        Markup.button.url(
          "📢 اشترك بالقناة",
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
   👑 OWNER KEYBOARD
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

  try {

    const user =
      ctx.from;

    const userId =
      String(user.id);


    /*
      المالك يتجاوز الاشتراك
    */

    if (
      userId !== OWNER_ID
    ) {

      const subscribed =
        await isSubscribed(
          user.id
        );

      if (!subscribed) {

        return requireSubscription(
          ctx
        );

      }

    }


    /*
      نقرأ البيانات قبل إنشاء المستخدم
    */

    const before =
      await loadData();

    const isNewUser =
      !before.users[userId];


    /*
      إنشاء المستخدم
    */

    await getUser(
      user.id,
      user.first_name ||
      "User"
    );


    /*
      Referral
    */

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

      await addReferral(
        user.id,
        referrerId
      );

    }


    /*
      إشعار المالك
    */

    if (
      isNewUser &&
      userId !== OWNER_ID
    ) {

      const updated =
        await loadData();

      const totalUsers =
        Object.keys(
          updated.users || {}
        ).length;


      try {

        await bot.telegram.sendMessage(

          OWNER_ID,

          "🚀🔥 مستخدم جديد دخل UC HUB!\n\n" +

          "👤 الاسم: " +
          (
            user.first_name ||
            "غير معروف"
          ) +
          "\n\n" +

          "🆔 ID: " +
          user.id +
          "\n\n" +

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


    /*
      رسالة المستخدم
    */

    if (
      userId === OWNER_ID
    ) {

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

  } catch (error) {

    console.error(
      "START ERROR:",
      error
    );

    await ctx.reply(
      "❌ حدث خطأ، حاول مرة ثانية."
    );

  }

});


/* =========================
   ✅ CHECK SUB
========================= */

bot.action(
  "CHECK_SUB",
  async (ctx) => {

    try {

      const subscribed =
        await isSubscribed(
          ctx.from.id
        );

      if (!subscribed) {

        return ctx.answerCbQuery(

          "❌ لسه ما اشتركت بالقناة.",

          {
            show_alert: true
          }

        );

      }


      await ctx.answerCbQuery(
        "✅ تم التحقق!"
      );


      await getUser(
        ctx.from.id,
        ctx.from.first_name ||
        "User"
      );


      await ctx.reply(

        "🎉 تم التحقق بنجاح!\n\n" +
        "✅ اشتراكك مؤكد.\n" +
        "🚀 يمكنك الآن استخدام UC HUB.",

        normalKeyboard()

      );

    } catch (error) {

      console.error(
        "CHECK SUB ERROR:",
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


  try {

    /*
      تحميل البيانات من Supabase
    */

    const data =
      await loadData();


    const users =
      Object.values(
        data.users || {}
      );

    const orders =
      data.orders || [];

    const referrals =
      data.referrals || {};


    /*
      إجمالي المستخدمين
    */

    const totalUsers =
      users.length;


    /*
      مجموع النقاط
    */

    const totalPoints =
      users.reduce(
        (sum, user) =>
          sum +
          Number(
            user.points || 0
          ),
        0
      );


    /*
      الإحالات
    */

    const totalReferrals =
      Object.keys(
        referrals
      ).length;


    /*
      الطلبات
    */

    const totalOrders =
      orders.length;


    const pendingOrders =
      orders.filter(
        order =>
          order.status ===
          "pending"
      ).length;


    const completedOrders =
      orders.filter(
        order =>
          order.status ===
          "completed"
      ).length;


    await ctx.answerCbQuery(
      "📊 تم تحديث الإحصائيات"
    );


    await ctx.reply(

      "📊🔥 إحصائيات UC HUB\n\n" +

      "👥 إجمالي المستخدمين:\n" +
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

      "💾 البيانات محفوظة في Supabase\n\n" +

      "🔥 UC HUB"

    );

  } catch (error) {

    console.error(
      "STATS ERROR:",
      error
    );

    await ctx.answerCbQuery(

      "❌ حدث خطأ أثناء تحميل الإحصائيات.",

      {
        show_alert: true
      }

    );

  }

}


/* =========================
   📊 STATS BUTTON
========================= */

bot.action(
  "BOT_STATS",
  async (ctx) => {

    try {

      await sendStats(
        ctx
      );

    } catch (error) {

      console.error(
        "STATS BUTTON ERROR:",
        error
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

      const data =
        await loadData();


      const id =
        String(ctx.from.id);


      await getUser(
        ctx.from.id,
        ctx.from.first_name ||
        "Owner"
      );


      const updated =
        await loadData();


      if (
        !updated.users[id]
      ) {

        return ctx.answerCbQuery(
          "❌ المستخدم غير موجود."
        );

      }


      updated.users[id].points =
        Number(
          updated.users[id].points || 0
        ) + 1000;


      /*
        حفظ النقاط في Supabase
      */

      const {
        saveData
      } = require("./database");


      await saveData(
        updated
      );


      await ctx.answerCbQuery(
        "🪙 تمت إضافة 1000 نقطة!"
      );


      await ctx.reply(

        "👑 تمت إضافة 1000 نقطة بنجاح!\n\n" +

        "🪙 النقاط المضافة: +1000\n\n" +

        "💰 رصيدك الآن: " +
        updated.users[id].points +
        " نقطة"

      );

    } catch (error) {

      console.error(
        "ADD POINTS ERROR:",
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
        "❌ هذا الأمر للمالك فقط."
      );

    }


    try {

      await sendStats(
        ctx
      );

    } catch (error) {

      console.error(
        "COMMAND STATS ERROR:",
        error
      );

    }

  }
);


/* =========================
   👤 USER API
========================= */

app.get(
  "/api/user/:id",
  async (req, res) => {

    try {

      const user =
        await getUser(
          req.params.id
        );


      res.json({

        id:
          user.id,

        firstName:
          user.firstName,

        points:
          user.points,

        referrals:
          user.referrals

      });

    } catch (error) {

      console.error(
        "USER API ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "حدث خطأ في تحميل بيانات المستخدم."

      });

    }

  }
);


/* =========================
   🎁 DAILY REWARD
========================= */

app.post(
  "/api/rewards/daily",
  async (req, res) => {

    try {

      const {
        userId
      } = req.body;


      if (!userId) {

        return res.status(400).json({

          success: false,

          message:
            "معرّف المستخدم مفقود."

        });

      }


      const result =
        await claimDailyReward(
          userId
        );


      res.json(
        result
      );

    } catch (error) {

      console.error(
        "DAILY ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "❌ حدث خطأ، حاول مرة ثانية."

      });

    }

  }
);


/* =========================
   📦 ORDER API
========================= */

app.post(
  "/api/order",
  async (req, res) => {

    try {

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
            "⚠️ بيانات الطلب ناقصة."

        });

      }


      const result =
        await createOrder(

          userId,

          Number(uc),

          Number(cost),

          String(playerId)

        );


      res.json(
        result
      );

    } catch (error) {

      console.error(
        "ORDER ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "❌ حدث خطأ أثناء إنشاء الطلب."

      });

    }

  }
);


/* =========================
   📦 ORDERS API
========================= */

app.get(
  "/api/orders/:id",
  async (req, res) => {

    try {

      const orders =
        await getOrders(
          req.params.id
        );


      res.json(

        orders.map(
          order => ({

            id:
              order.id,

            userId:
              order.user_id,

            uc:
              order.uc,

            cost:
              order.cost,

            playerId:
              order.player_id,

            status:
              order.status,

            createdAt:
              order.created_at

          })
        )

      );

    } catch (error) {

      console.error(
        "ORDERS ERROR:",
        error
      );

      res.status(500).json([]);

    }

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

      res.sendStatus(
        200
      );

    } catch (error) {

      console.error(
        "WEBHOOK ERROR:",
        error
      );

      res.sendStatus(
        500
      );

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
