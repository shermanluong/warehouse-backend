const mongoose = require('mongoose');
const Order = require('../models/order.model');

// Fetch orders assigned to the picker (e.g., from query param or session)
const getPickerOrders = async (req, res) => {
  try {
    const { userId } = req.user;

    let match = {
      $and: [
        { pickerId: userId },
        { status: { $in: ['new', 'picking'] } }
      ]
    };

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
          },
          lineItemCount: { $size: "$lineItems" } // ✅ Line item count added here
        }
      }
    ]);

    res.json(orders);
  } catch (err) {
    console.error('Error fetching picker orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//PATCH /api/picker/order/:id/pick-item
const pickItem =  async (req, res) => {
  const { id } = req.params;
  const { productId } = req.body;
  console.log(id);
  console.log(productId);
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  item.picked = true;
  if (order.status == "new" ) order.status = "picking";
  await order.save();

  res.json({ message: 'Item marked as picked' });
}

// Get /api/picker/order/:id
const getPickingOrder = async (req, res) => {
  const orderId = req.params.id;

  try {
    const objectId = new mongoose.Types.ObjectId(orderId);

    const order = await Order.aggregate([
      { $match: { _id: objectId } },
      {
        $project: {
          shopifyOrderId: 1,
          status: 1,
          pickerId: 1,
          packerId: 1,
          createdAt: 1,
          customer: 1,
          delivery: 1,
          lineItems: 1,
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

    if (!order || order.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order[0]); // Aggregation returns an array
  } catch (error) {
    console.error('Error getting picking order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/picker/order/:orderId/scan
const scanBarcode = async (req, res) => {
  const { orderId } = req.params;
  const { barcode } = req.body;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const item = order.lineItems.find(item => item.variantId === barcode);
  if (!item) return res.status(400).json({ message: "Item not found" });

  if (item.pickedQuantity < item.quantity) {
    item.pickedQuantity += 1;
  }

  if (item.pickedQuantity >= item.quantity) {
    item.picked = true;
  }

  await order.save();
  res.json({ success: true, item });
};

// POST /api/picker/order/:orderId/complete-picking
const completePicking = async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  const allPicked = order.lineItems.every(item => item.picked);
  if (!allPicked) return res.status(400).json({ message: "Not all items picked" });

  order.status = 'picked';
  await order.save();

  res.json({ success: true });
};

module.exports = {
  getPickerOrders,
  getPickingOrder,
  pickItem,
  scanBarcode,
  completePicking
};
