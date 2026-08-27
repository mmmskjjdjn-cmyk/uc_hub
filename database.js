const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   📦 LOAD DATA
========================= */

async function loadData() {

  const [
    usersResult,
    referralsResult,
    ordersResult,
    paymentsResult,
    dailyResult
  ] = await Promise.all([

    supabase
      .from("users")
      .select("*"),

    supabase
      .from("referrals")
      .select("*"),

    supabase
      .from("orders")
      .select("*"),

    supabase
      .from("payments")
      .select("*"),

    supabase
      .from("daily_rewards")
      .select("*")

  ]);

  if (usersResult.error)
    throw usersResult.error;

  if (referralsResult.error)
    throw referralsResult.error;

  if (ordersResult.error)
    throw ordersResult.error;

  if (paymentsResult.error)
    throw paymentsResult.error;

  if (dailyResult.error)
    throw dailyResult.error;

  const users = {};

  for (const u of usersResult.data || []) {

    users[String(u.id)] = {

      id: String(u.id),

      firstName:
        u.first_name || "User",

      points:
        Number(u.points || 0),

      referrals:
        Number(u.referrals || 0),

      createdAt:
        u.created_at

    };

  }

  const referrals = {};

  for (const r of referralsResult.data || []) {

    referrals[String(r.new_user_id)] =
      String(r.referrer_id);

  }

  const orders =
    (ordersResult.data || []).map(o => ({

      id: String(o.id),

      userId:
        String(o.user_id),

      uc:
        Number(o.uc),

      cost:
        Number(o.cost),

      playerId:
        String(o.player_id),

      status:
        o.status || "pending",

      createdAt:
        o.created_at

    }));

  const payments = {};

  for (const p of paymentsResult.data || []) {

    payments[String(p.charge_id)] = {

      userId:
        String(p.user_id),

      stars:
        Number(p.stars),

      points:
        Number(p.points),

      createdAt:
        p.created_at

    };

  }

  const dailyRewards = {};

  for (const d of dailyResult.data || []) {

    dailyRewards[String(d.user_id)] =
      String(d.reward_date);

  }

  return {

    users,

    referrals,

    orders,

    payments,

    dailyRewards

  };

}


/* =========================
   💾 SAVE DATA
========================= */

async function saveData(data) {

  /*
    البيانات الجديدة يتم حفظها
    مباشرة في Supabase.
  */

  for (const user of Object.values(data.users || {})) {

    const { error } =
      await supabase
        .from("users")
        .upsert({

          id: String(user.id),

          first_name:
            user.firstName || "User",

          points:
            Number(user.points || 0),

          referrals:
            Number(user.referrals || 0),

          created_at:
            user.createdAt || new Date().toISOString()

        });

    if (error)
      throw error;

  }

}


/* =========================
   👤 GET USER
========================= */

async function getUser(
  userId,
  firstName = "User"
) {

  const id = String(userId);

  const { data, error } =
    await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

  if (error)
    throw error;

  if (data) {

    return {

      id: String(data.id),

      firstName:
        data.first_name || firstName,

      points:
        Number(data.points || 0),

      referrals:
        Number(data.referrals || 0),

      createdAt:
        data.created_at

    };

  }

  const newUser = {

    id,

    first_name:
      firstName || "User",

    points: 0,

    referrals: 0

  };

  const { data: created, error: createError } =
    await supabase
      .from("users")
      .insert(newUser)
      .select()
      .single();

  if (createError)
    throw createError;

  return {

    id: String(created.id),

    firstName:
      created.first_name,

    points:
      Number(created.points || 0),

    referrals:
      Number(created.referrals || 0),

    createdAt:
      created.created_at

  };

}


/* =========================
   🔗 REFERRAL
========================= */

async function addReferral(
  newUserId,
  referrerId
) {

  const newId =
    String(newUserId);

  const refId =
    String(referrerId);

  if (newId === refId)
    return false;

  const { data: existing } =
    await supabase
      .from("referrals")
      .select("new_user_id")
      .eq("new_user_id", newId)
      .maybeSingle();

  if (existing)
    return false;

  await getUser(newId);

  const referrer =
    await getUser(refId);

  const { error } =
    await supabase
      .from("referrals")
      .insert({

        new_user_id:
          newId,

        referrer_id:
          refId

      });

  if (error)
    throw error;

  const { error: updateError } =
    await supabase
      .from("users")
      .update({

        points:
          Number(referrer.points || 0) + 1,

        referrals:
          Number(referrer.referrals || 0) + 1

      })
      .eq("id", refId);

  if (updateError)
    throw updateError;

  return true;

}


/* =========================
   🎁 DAILY REWARD
========================= */

async function claimDailyReward(userId) {

  const id =
    String(userId);

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const user =
    await getUser(id);

  const { data: reward } =
    await supabase
      .from("daily_rewards")
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

  if (
    reward &&
    String(reward.reward_date) === today
  ) {

    return {

      success: false,

      message:
        "🎁 أخذت هديتك اليومية اليوم!\n\n" +
        "⏰ ارجع بكرا وخذ نقطة جديدة 🪙"

    };

  }

  const { error: rewardError } =
    await supabase
      .from("daily_rewards")
      .upsert({

        user_id: id,

        reward_date: today

      });

  if (rewardError)
    throw rewardError;

  const newBalance =
    Number(user.points || 0) + 1;

  const { error: userError } =
    await supabase
      .from("users")
      .update({

        points:
          newBalance

      })
      .eq("id", id);

  if (userError)
    throw userError;

  return {

    success: true,

    points: 1,

    balance:
      newBalance

  };

}


/* =========================
   ⭐ STARS
========================= */

async function addStarsPurchase(
  userId,
  stars,
  points,
  chargeId
) {

  const id =
    String(userId);

  const charge =
    String(chargeId);

  const { data: existing } =
    await supabase
      .from("payments")
      .select("charge_id")
      .eq("charge_id", charge)
      .maybeSingle();

  if (existing) {

    return {

      success: false,

      duplicate: true

    };

  }

  const user =
    await getUser(id);

  const newBalance =
    Number(user.points || 0) +
    Number(points);

  const { error: paymentError } =
    await supabase
      .from("payments")
      .insert({

        charge_id:
          charge,

        user_id:
          id,

        stars:
          Number(stars),

        points:
          Number(points)

      });

  if (paymentError)
    throw paymentError;

  const { error: userError } =
    await supabase
      .from("users")
      .update({

        points:
          newBalance

      })
      .eq("id", id);

  if (userError)
    throw userError;

  return {

    success: true,

    newBalance

  };

}


/* =========================
   📦 CREATE ORDER
========================= */

async function createOrder(
  userId,
  uc,
  cost,
  playerId
) {

  const id =
    String(userId);

  const user =
    await getUser(id);

  if (
    Number(user.points) <
    Number(cost)
  ) {

    return {

      success: false,

      message:
        "❌ رصيد النقاط غير كافٍ.\n\n" +
        "🪙 اجمع المزيد من النقاط ثم حاول مرة أخرى."

    };

  }

  const newBalance =
    Number(user.points) -
    Number(cost);

  const order = {

    id:
      Date.now().toString(),

    user_id:
      id,

    uc:
      Number(uc),

    cost:
      Number(cost),

    player_id:
      String(playerId),

    status:
      "pending"

  };

  const { error: orderError } =
    await supabase
      .from("orders")
      .insert(order);

  if (orderError)
    throw orderError;

  const { error: userError } =
    await supabase
      .from("users")
      .update({

        points:
          newBalance

      })
      .eq("id", id);

  if (userError)
    throw userError;

  return {

    success: true,

    order: {

      id:
        order.id,

      userId:
        id,

      uc:
        Number(uc),

      cost:
        Number(cost),

      playerId:
        String(playerId),

      status:
        "pending",

      createdAt:
        new Date().toISOString()

    },

    balance:
      newBalance

  };

}


/* =========================
   📦 GET ORDERS
========================= */

async function getOrders(userId) {

  const { data, error } =
    await supabase
      .from("orders")
      .select("*")
      .eq("user_id", String(userId))
      .order("created_at", {
        ascending: false
      });

  if (error)
    throw error;

  return data || [];

}


/* =========================
   📤 EXPORT
========================= */

module.exports = {

  loadData,

  saveData,

  getUser,

  addReferral,

  claimDailyReward,

  addStarsPurchase,

  createOrder,

  getOrders

};
