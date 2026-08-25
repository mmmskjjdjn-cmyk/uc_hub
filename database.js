const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      users: {},
      referrals: {},
      orders: [],
      payments: []
    };
  }

  try {
    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    if (!data.users) data.users = {};
    if (!data.referrals) data.referrals = {};
    if (!data.orders) data.orders = [];
    if (!data.payments) data.payments = [];

    return data;

  } catch {
    return {
      users: {},
      referrals: {},
      orders: [],
      payments: []
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
      createdAt: new Date().toISOString()
    };

    saveData(data);

  } else if (firstName && data.users[id].firstName === "User") {

    data.users[id].firstName = firstName;
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
    data.users[newId] = {
      id: newId,
      firstName: "User",
      points: 0,
      referrals: 0,
      createdAt: new Date().toISOString()
    };
  }

  if (!data.users[refId]) {
    data.users[refId] = {
      id: refId,
      firstName: "User",
      points: 0,
      referrals: 0,
      createdAt: new Date().toISOString()
    };
  }

  if (data.referrals[newId]) {
    return false;
  }

  data.referrals[newId] = refId;

  data.users[refId].points += 1;
  data.users[refId].referrals += 1;

  saveData(data);

  return true;
}

function getPoints(userId) {
  const data = loadData();

  const user =
    data.users[String(userId)];

  return user ? user.points : 0;
}

function addStarsPurchase(
  userId,
  stars,
  points,
  chargeId
) {
  const data = loadData();

  const id = String(userId);

  if (!data.users[id]) {
    data.users[id] = {
      id,
      firstName: "User",
      points: 0,
      referrals: 0,
      createdAt: new Date().toISOString()
    };
  }

  // منع إضافة نفس عملية الدفع مرتين
  const alreadyPaid =
    data.payments.some(
      payment =>
        payment.chargeId === chargeId
    );

  if (alreadyPaid) {
    return {
      success: false,
      duplicate: true,
      message: "عملية الدفع مسجلة مسبقاً"
    };
  }

  data.users[id].points += Number(points);

  data.payments.push({
    id: Date.now().toString(),
    userId: id,
    stars: Number(stars),
    points: Number(points),
    chargeId,
    createdAt: new Date().toISOString()
  });

  saveData(data);

  return {
    success: true,
    pointsAdded: Number(points),
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
    order
  };
}

module.exports = {
  loadData,
  saveData,
  getUser,
  addReferral,
  getPoints,
  addStarsPurchase,
  createOrder
};
