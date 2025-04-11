const Order = require('../models/order.model');

const getOrdersByRole = async (req, res) => {
  const { role, _id: userId } = req.user;

  let filter = {};
  if (role === 'picker') {
    filter = { pickerId: userId };
  } else if (role === 'packer') {
    filter = { status: 'picked' };
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.json(orders);
};

module.exports = { getOrdersByRole };
