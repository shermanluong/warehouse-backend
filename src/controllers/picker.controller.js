const mongoose = require('mongoose');
const Order = require('../models/order.model');

// Fetch orders assigned to the picker (e.g., from query param or session)
const getPickerOrders = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.userId); // convert string to ObjectId

    let match = {
      $and: [
        { pickerId: userObjectId },
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
          adminNote: { $ifNull: ["$adminNote", null] }, // 👈 force include null if missing
          orderNote: 1,
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

// Get /api/picker/order/:id
const getPickingOrder = async (req, res) => {
  const orderId = req.params.id;

  try {
    const objectId = new mongoose.Types.ObjectId(orderId);

    const order = await Order.aggregate([
      { $match: { _id: objectId } },
      { $unwind: "$lineItems" },
      {
        $lookup: {
          from: "products",
          localField: "lineItems.productId",
          foreignField: "shopifyProductId",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $addFields: {
          "lineItems.productTitle": "$productInfo.title",
          "lineItems.image": "$productInfo.image",
          "lineItems.variantInfo": {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$productInfo.variants",
                  as: "variant",
                  cond: {
                    $eq: ["$$variant.shopifyVariantId", "$lineItems.variantId"]
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: "$_id",
          shopifyOrderId: { $first: "$shopifyOrderId" },
          orderNote: { $first: "$orderNote" },
          adminNote: { $first: "$adminNote" },
          status: { $first: "$status" },
          pickerId: { $first: "$pickerId" },
          packerId: { $first: "$packerId" },
          createdAt: { $first: "$createdAt" },
          customer: { $first: "$customer" },
          delivery: { $first: "$delivery" },
          lineItems: { $push: "$lineItems" },
        }
      },
      {
        $addFields: {
          lineItems: {
            $sortArray: {
              input: "$lineItems",
              sortBy: { "variantInfo.sku": 1 }
            }
          }
        }
      },
      {
        $addFields: {
          totalQuantity: {
            $sum: {
              $map: {
                input: "$lineItems",
                as: "item",
                in: "$$item.quantity"
              }
            }
          },
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
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order[0]);
  } catch (error) {
    console.error("Error getting picking order:", error);
    res.status(500).json({ message: "Server error" });
  }
};


//PATCH /api/picker/order/:id/pick-item
const pickItem =  async (req, res) => {
  const { id } = req.params;
  const { productId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  item.picked = true;
  if (order.status == "new" ) order.status = "picking";
  await order.save();

  res.json({ message: 'Item marked as picked' });
}

//PATCH /api/picker/order/:id/pick-plus
const pickPlusItem =  async (req, res) => {
  const { id } = req.params;
  const { productId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (item.pickedQuantity < item.quantity) {
    item.pickedQuantity += 1;
  }

  if (item.pickedQuantity >= item.quantity) {
    item.picked = true;
  }

  if (order.status == "new" ) order.status = "picking";
  await order.save();

  res.json({ success: true, item });
}

//PATCH /api/picker/order/:id/pick-minus
const pickMinusItem =  async (req, res) => {
  const { id } = req.params;
  const { productId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (item.pickedQuantity > 0) {
    item.pickedQuantity -= 1;
  }

  if (item.pickedQuantity < item.quantity) {
    item.picked = false;
  }

  if (order.status == "new" ) order.status = "picking";
  await order.save();

  res.json({ success: true, item });
}

//PATCH /api/picker/order/:id/pick-flag
const pickFlagItem =  async (req, res) => {
  const { id } = req.params;
  const { productId, reason } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (!item.flags.includes(reason)) {
    item.picked = false;
    item.flags.push(reason);
  }

  await order.save();
  res.json({ message: 'Flag added', item });
}

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

const isPickingComplete = (lineItems) => {
  return lineItems.every(item => 
    item.picked || (item.flags && item.flags.length > 0)
  );
};

// POST /api/picker/order/:orderId/complete-picking
const completePicking = async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (!isPickingComplete(order.lineItems)) {
    return res.status(400).json({ message: 'All items must be picked or flagged to complete picking.' });
  }

  order.status = 'picked';
  await order.save();

  res.json({ success: true });
};

module.exports = {
  getPickerOrders,
  getPickingOrder,
  pickItem,
  pickPlusItem,
  pickMinusItem,
  pickFlagItem,
  scanBarcode,
  completePicking
};
