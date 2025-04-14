const Order = require('../models/order.model');

const getOrdersByRole = async (req, res) => {
  const { role, userId } = req.user;

  let match = {};
  if (role === 'picker') {
    match = { pickerId: userId };
  } else if (role === 'packer') {
    match = { status: 'picked' };
  }

  const orders = await Order.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $project: {
        shopifyOrderId: 1,
        status: 1,
        pickerId: 1,
        packerId: 1,
        createdAt: 1,
        customer: 1, // ✅ include customer field
        totalQuantity: { $sum: "$lineItems.quantity" },
        pickedCount: {
          $sum: {
            $map: {
              input: "$lineItems",
              as: "item",
              in: {
                $cond: [{ $eq: ["$$item.picked", true] }, "$$item.quantity", 0]
              }
            }
          }
        },
        packedCount: {
          $sum: {
            $map: {
              input: "$lineItems",
              as: "item",
              in: {
                $cond: [{ $eq: ["$$item.packed", true] }, "$$item.quantity", 0]
              }
            }
          }
        }
      }
    }
  ]);

  res.json(orders);
};

module.exports = { getOrdersByRole };
