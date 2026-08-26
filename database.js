const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      users: {},
      referrals: {},
      orders: [],
      payments: {},
      dailyRewards: {}
    };
  }

  try {
    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    data.users ||= {};
    data.referrals ||= {};
    data.orders ||= [];
    data.payments ||= {};
    data.dailyRewards ||= {};

    return data;
  } catch {
    return {
      users: {},
      referrals: {},
      orders: [],
      payments: {},
      dailyRewards: {}
    };
  }
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

function getUser(userId, firstName = "User") {
  const data = loadData();
  const id = String(userId);

  if (!data.users[id]) {
    data.users[id] = {
      id,
      firstName,
      points: 0,
      referrals: 0,
      channelRewardClaimed: false,
      createdAt: new Date().toISOString()
    };

    saveData(data);
  }

  return data.users[id];
}

function addReferral(newUserId, referrerId) {
  const data = loadData();

  const newId = String(newUserId);
  const refId = String(referrerId);

  if (newId === refId) return false;

  if (!data.users[newId]) {
    getUser(newId);
  }

  if (!data.users[refId]) {
    getUser(refId);
  }

  if (data.referrals[newId]) {
    return false;
  }

  data.referrals[newId] = refId;

  data.users[refId].points += 3;
  data.users[refId].referrals += 1;

  saveData(data);

  return true;
}

function claimDailyReward(userId) {
  const data = loadData();
  const id = String(userId);

  const user = data.users[id] || getUser(id);

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (data.dailyRewards[id] === today) {
    return {
      success: false,
      message: "أخذت هديتك اليومية اليوم 🎁"
    };
  }

  data.dailyRewards[id] = today;

  user.points += 1;

  saveData(data);

  return {
    success: true,
    points: 1,
    balance: user.points
  };
}

function addStarsPurchase(
  userId,
  stars,
  points,
  chargeId
) {
  const data = loadData();
  const id = String(userId);

  if (data.payments[chargeId]) {
    return {
      success: false,
      duplicate: true
    };
  }

  if (!data.users[id]) {
    getUser(id);
  }

  data.users[id].points += Number(points);

  data.payments[chargeId] = {
    userId: id,
    stars: Number(stars),
    points: Number(points),
    createdAt: new Date().toISOString()
  };

  saveData(data);

  return {
    success: true,
    newBalance: data.users[id].points
  };
}

function createOrder(
  userId,
  uc,
  cost,
  playerId
) {
  const data = loadData();

  const user =
    data.users[String(userId)];

  if (!user || user.points < cost) {
    return {
      success: false,
      message: "رصيد النقاط غير كافٍ"
    };
  }

  user.points -= cost;

  const order = {
    id: Date.now().toString(),
    userId: String(userId),
    uc,
    cost,
    playerId,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  data.orders.push(order);

  saveData(data);

  return {
    success: true,
    order,
    balance: user.points
  };
}

function getOrders(userId) {
  const data = loadData();

  return data.orders.filter(
    order =>
      order.userId === String(userId)
  );
}

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
