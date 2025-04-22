const mongoose = require('mongoose');
const Order = require('../models/order.model');
const { Types } = require('mongoose');
const ObjectId = Types.ObjectId;

// const locate2UService = require('../services/locate2u.service'); // optional
// const photoUploader = require('../services/photo.service');       // optional
// const slackNotifier = require('../services/slack.service');       // optional

// Get picked orders assigned to the packer
const getPickedOrders = async (req, res) => {
  try {
    const { userId } = req.user;
    console.log(userId);
    const match = {
      $or: [
        { status: 'picked' },
        { 
          $and: [
            { status: 'packing' },
            { packerId: new ObjectId(userId) }
          ]
        }
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
    console.error('Error fetching picked orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get /api/packer/order/:id
const getPackingOrder = async (req, res) => {
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
      // Substitution product lookup
      {
        $lookup: {
          from: "products",
          localField: "lineItems.substitution.substituteProductId",
          foreignField: "shopifyProductId",
          as: "subProduct"
        }
      },
      {
        $unwind: {
          path: "$subProduct",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          "lineItems.substitution.variantInfo": {
            $let: {
              vars: {
                variant: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$subProduct.variants",
                        as: "variant",
                        cond: {
                          $eq: ["$$variant.shopifyVariantId", "$lineItems.substitution.substituteVariantId"]
                        }
                      },
                    },
                    0,
                  ]
                }
              },
              in: {
                shopifyVariantId: "$$variant.shopifyVariantId",
                title: {
                  $cond: [
                    { $eq: ["$$variant.title", "Default Title"] },
                    "$subProduct.title",
                    "$$variant.title"
                  ]
                },
                sku: "$$variant.sku",
                barcode: "$$variant.barcode",
                price: "$$variant.price",
                inventory_quantity: "$$variant.inventory_quantity",
                image: {
                  $cond: [
                    { $eq: ["$$variant.image", ""] },
                    "$subProduct.image",
                    "$$variant.image"
                  ]
                }
              }
            }
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
          lineItems: { $push: "$lineItems" }
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
    console.error("Error getting packing order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//PATCH /api/packer/order/:id/pack-item
const packItem =  async (req, res) => {
  const { id } = req.params;
  const { productId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  const packerObjectId = new mongoose.Types.ObjectId(req.user.userId); // convert string to ObjectId
  order.packerId= packerObjectId;
  item.packed = true;
  if (order.status == "picked" ) order.status = "packing";
  await order.save();

  res.json({ message: 'Item marked as packed' });
}

//PATCH /api/packer/order/:id/undo-item
const undoItem = async (req, res) => {
  const { id } = req.params;
  const { productId, variantId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(
      i => i.productId === productId && i.variantId === variantId
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.packed = false;
    item.packedQuantity = 0;

    await order.save();
    res.json({ message: 'Item successfully reset' });
  } catch (err) {
    console.error("Undo error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

//PATCH /api/packer/order/:id/cancel-sub-item
const cancelSubItem = async (req, res) => {
  const { id } = req.params;
  const { productId, variantId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(
      i => i.productId === productId && i.variantId === variantId
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.substitution = null;

    await order.save();
    res.json({ message: 'Cancel Sub Item successfully' });
  } catch (err) {
    console.error("Cancel sub error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

//PATCH /api/packer/order/:id/confirm-sub-item
const confirmSubItem = async (req, res) => {
  const { id } = req.params;
  const { productId, variantId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(
      i => i.productId === productId && i.variantId === variantId
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.substitution.used = true;

    await order.save();
    res.json({ message: 'Confirm Sub Item successfully' });
  } catch (err) {
    console.error("Confirm error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

//PATCH /api/packer/order/:id/pack-plus
const packPlusItem =  async (req, res) => {
  const { id } = req.params;
  const { productId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (item.packedQuantity < item.quantity) {
    item.packedQuantity += 1;
  }

  if (item.packedQuantity >= item.quantity) {
    item.packed = true;
  }

  if (order.status == "picked" ) order.status = "packing";
  await order.save();

  res.json({ success: true, item });
}

//PATCH /api/packer/order/:id/pack-minus
const packMinusItem =  async (req, res) => {
  const { id } = req.params;
  const { productId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (item.packedQuantity > 0) {
    item.packedQuantity -= 1;
  }

  if (item.packedQuantity < item.quantity) {
    item.packed = false;
  }

  if (order.status == "picked" ) order.status = "packing";
  await order.save();

  res.json({ success: true, item });
}

const startPacking = async (req, res) => {
  const { orderId } = req.params;
  const { userId } = req.user;
  const packerId = userId;

  try {
    const updated = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: 'packing',
          packerId: packerId,
        },
      },
      { new: true }
    );

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Error starting packing:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// Finalize packing (updates order status, adds photo, logs, etc.)
const finalisePack = async (req, res) => {
  try {
    const { orderId, photoUrl, packerId, logs = [] } = req.body;

    const order = await Order.findOneAndUpdate(
      { shopifyOrderId: orderId },
      {
        $set: {
          status: 'packed',
          packerId,
          photoUrl,
          updatedAt: new Date()
        },
        $push: {
          logs: { $each: logs }
        }
      },
      { new: true }
    );

    // Optionally:
    // await locate2UService.syncOrder(order);
    // await slackNotifier.sendPackedAlert(order);

    res.json({ message: 'Order packed successfully', order });
  } catch (err) {
    console.error('Error finalizing pack:', err);
    res.status(500).json({ error: 'Failed to finalize pack' });
  }
};

module.exports = {
  getPickedOrders,
  getPackingOrder,
  packItem,
  undoItem,
  cancelSubItem,
  confirmSubItem,
  packPlusItem,
  packMinusItem,
  startPacking,
  finalisePack,
};
