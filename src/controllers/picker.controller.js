const mongoose = require('mongoose');
const Order = require('../models/order.model');
const Tote = require('../models/tote.model');
const createNotification = require('../utils/createNotification');
const { getVariantDisplayTitle } = require('../utils/getVariantTitle');

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
      {
        $project: {
          shopifyOrderId: 1,
          name: 1,
          orderNumber: 1,
          status: 1,
          pickerId: 1,
          packerId: 1,
          delivery: 1,
          adminNote: { $ifNull: ["$adminNote", null] }, // 👈 force include null if missing
          orderNote: 1,
          createdAt: 1,
          customer: 1, // ✅ include customer field
          totalQuantity: { $sum: "$lineItems.quantity" },
          pickedCount: {
            $size: {
              $filter: {
                input: "$lineItems",
                as: "item",
                cond: { $eq: ["$$item.picked", true] }
              }
            }
          },
          packedCount: {
            $size: {
              $filter: {
                input: "$lineItems",
                as: "item",
                cond: { $eq: ["$$item.packed", true] }
              }
            }
          },
          lineItemCount: { $size: "$lineItems" } // ✅ Line item count added here
        }
      },
      {
        $sort: {
          'delivery.tripId': 1, // Sort tripId in ascending order (increase)
          'delivery.stopNumber': -1 // Sort stopNumber in descending order (decrease)
        }
      },
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

      // Lookup original product
      {
        $lookup: {
          from: "products",
          localField: "lineItems.productId",
          foreignField: "shopifyProductId",
          as: "productInfo"
        }
      },
      {
        $unwind: {
          path: "$productInfo",
          preserveNullAndEmptyArrays: true // This will keep lineItems even if no matching product is found
        }
      },
      {
        $addFields: {
          "lineItems.productTitle": { $ifNull: ["$productInfo.title", "Default Title"] },
          "lineItems.image": { $ifNull: ["$productInfo.image", ""] },
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

      // Precompute the field to use for lookup (outOfStock or damaged)
      {
        $addFields: {
          substitutionProductId: {
            $ifNull: [
              "$lineItems.pickedStatus.outOfStock.subbed.productId", 
              "$lineItems.pickedStatus.damaged.subbed.productId"
            ]
          }
        }
      },

      // Lookup substitute product (using the precomputed substitutionProductId)
      {
        $lookup: {
          from: "products",
          localField: "substitutionProductId", // Use the precomputed field
          foreignField: "shopifyProductId",
          as: "subProduct"
        }
      },

      {
        $addFields: {
          "lineItems.substitution": {
            $let: {
              vars: {
                matchedVariant: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: {
                          $ifNull: [
                            { $arrayElemAt: ["$subProduct.variants", 0] },
                            []
                          ]
                        },
                        as: "variant",
                        cond: {
                          $eq: [
                            "$$variant.shopifyVariantId",
                            {
                              $ifNull: [
                                "$lineItems.pickedStatus.outOfStock.subbed.variantId",
                                "$lineItems.pickedStatus.damaged.subbed.variantId"
                              ]
                            }
                          ]
                        }
                      },
                    },
                    0
                  ]
                },
                productTitle: { $arrayElemAt: ["$subProduct.title", 0] },
                productImage: { $arrayElemAt: ["$subProduct.image", 0] }
              },
              in: {
                $mergeObjects: [
                  "$$matchedVariant",
                  {
                    title: {
                      $cond: [
                        { $eq: ["$$matchedVariant.title", "Default Title"] },
                        "$$productTitle",
                        "$$matchedVariant.title"
                      ]
                    },
                    image: {
                      $cond: [
                        {
                          $or: [
                            { $eq: ["$$matchedVariant.image", null] },
                            { $eq: ["$$matchedVariant.image", ""] }
                          ]
                        },
                        "$$productImage",
                        "$$matchedVariant.image"
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // Clean up subProduct
      {
        $project: {
          productInfo: 0,
          subProduct: 0
        }
      },

      // Group back the order
      {
        $group: {
          _id: "$_id",
          shopifyOrderId: { $first: "$shopifyOrderId" },
          name: { $first: "$name" },
          orderNumber: { $first: "$orderNumber" },
          orderNote: { $first: "$orderNote" },
          adminNote: { $first: "$adminNote" },
          status: { $first: "$status" },
          pickerId: { $first: "$pickerId" },
          createdAt: { $first: "$createdAt" },
          customer: { $first: "$customer" },
          delivery: { $first: "$delivery" },
          lineItems: { $push: "$lineItems" }
        }
      },

      {
        $addFields: {
          lineItems: {
            $map: {
              input: "$lineItems",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    skuSortKey: "$$item.variantInfo.sku"
                  }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          lineItems: {
            $sortArray: {
              input: "$lineItems",
              sortBy: {
                skuSortKey: 1 // Lexicographic sort
              }
            }
          }
        }
      },

      // Compute totals
      {
        $addFields: {
          pickedCount: {
            $size: {
              $filter: {
                input: "$lineItems",
                as: "item",
                cond: { $eq: ["$$item.picked", true] }
              }
            }
          },
          packedCount: {
            $size: {
              $filter: {
                input: "$lineItems",
                as: "item",
                cond: { $eq: ["$$item.packed", true] }
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
const pickPlusItem = async (req, res) => {
  const { id } = req.params;
  const { shopifyLineItemId, quantity = 1 } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (item.picked === true) {
    return res.status(400).json({ message: 'Item has already been picked' });
  }

  const pickedStatus = item.pickedStatus;
  const alreadyPicked = pickedStatus.verified.quantity + pickedStatus.damaged.quantity + pickedStatus.outOfStock.quantity;
  const availableToPick = item.quantity - alreadyPicked;

  // Ensure we do not over-pick
  const pickQuantity = Math.min(quantity, availableToPick);
  pickedStatus.verified.quantity += pickQuantity;

  const totalPickedQuantity = pickedStatus.verified.quantity + pickedStatus.damaged.quantity + pickedStatus.outOfStock.quantity;

  if (totalPickedQuantity >= item.quantity) {
    item.picked = true;
  }

  await order.save();
  res.json({ success: true, item });
};

//PATCH /api/picker/order/:id/pick-minus
const pickMinusItem =  async (req, res) => {
  const { id } = req.params;
  const { shopifyLineItemId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  const pickedStatus = item.pickedStatus;
  let totalPickedQuantity = pickedStatus.verified.quantity + pickedStatus.damaged.quantity + pickedStatus.outOfStock.quantity;

  if (totalPickedQuantity > 0) {
    totalPickedQuantity -= 1;
    pickedStatus.verified.quantity -= 1;
  }

  if (totalPickedQuantity < item.quantity) {
    item.picked = false;
  }

  await order.save();
  res.json({ success: true, item });
}

//PATCH /api/picker/order/:id/undo-item
const undoItem = async (req, res) => {
  const { id } = req.params;
  const { shopifyLineItemId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(
      i => i.shopifyLineItemId === shopifyLineItemId && i.variantId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.picked = false;
    item.pickedStatus = {...item.pickedStatus, verified: {quantity: 0}, damaged: {quantity: 0}, outOfStock: {quantity: 0}};

    await order.save();
    res.json({ message: 'Item successfully reset' });
  } catch (err) {
    console.error("Undo error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

//PATCH /api/picker/order/:id/pick-flag
const pickFlagItem = async (req, res) => {
  const { id } = req.params;
  const { shopifyLineItemId, reason, quantity} = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  const pickedStatus = item.pickedStatus;
  const totalPickedQuantity = pickedStatus.verified.quantity + pickedStatus.damaged.quantity + pickedStatus.outOfStock.quantity + quantity;

  if ( reason === 'Out Of Stock' ) {
    pickedStatus.outOfStock.quantity += totalPickedQuantity > item.quantity ? (quantity - (totalPickedQuantity - item.quantity)) : quantity;
  } else if (reason === 'Damaged') {
    pickedStatus.damaged.quantity += totalPickedQuantity > item.quantity ? (quantity - (totalPickedQuantity - item.quantity)) : quantity;
  } else {
    return res.status(404).json({message: 'Unreasonable'})
  }

  if ( totalPickedQuantity >= item.quantity ) item.picked = true;
  else item.picked = false;

  await order.save();
  res.json({ message: 'Flag updated', item });
};

//PATCH /api/picker/order/:id/pick-flag
const pickSubstituteItem = async (req, res) => {
  const { id } = req.params;
  const { shopifyLineItemId, reason, quantity, subbedProductId, subbedVariantId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (reason === 'Out Of Stock') {
    const outOfStock = item.pickedStatus.outOfStock;
    outOfStock.quantity = quantity;
    outOfStock.subbed.productId = subbedProductId;
    outOfStock.subbed.variantId = subbedVariantId;
  } else if (reason === 'Damaged' ) {
    const damaged = item.pickedStatus.damaged;
    damaged.quantity = quantity;
    damaged.subbed.productId = subbedProductId;
    damaged.subbed.variantId = subbedVariantId;
  } else {
    return res.status(404).json({message: 'Unreasonable'});
  }

  item.picked = true;
  await order.save();
  res.json({ message: 'Flag updated', item });
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

const isPickingComplete = (lineItems) => {
  return lineItems.every(item => 
    item.picked 
  );
};

// POST /api/picker/order/:orderId/complete-picking
const completePicking = async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.lineItems.forEach(element => {
    if (!element.picked) console.log(element);
  });
  
  if (!isPickingComplete(order.lineItems)) {
    return res.status(400).json({ message: 'All items must be picked or flagged to complete picking.' });
  }
 
  order.status = 'picked';
  await order.save();

  res.json({ success: true });
};

const getAvailableTotes =  async (req, res) => {
  try {
    const availableTotes = await Tote.find({ status: 'available' });
    res.json(availableTotes);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

const assignTote = async (req, res) => {
  const { toteId, orderId } = req.body;
  try {
    // Find the tote and the order by their respective IDs
    const tote = await Tote.findById(toteId);
    const order = await Order.findById(orderId);

    if (!tote || !order) {
      return res.status(404).json({ error: "Tote or Order not found" });
    }

    // Assign the tote to the order and update the tote's order field
    tote.assignedToOrder = orderId;
    tote.status = 'assigned'; // Update the status of the tote
    await tote.save();

    if (!order.totes.includes(toteId)) {
      order.totes.push(toteId);
      await order.save();
    }

    res.status(200).json({ message: "Tote assigned to order", tote, order });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign tote to order", details: error.message });
  }
};

const removeTote = async (req, res) => {
  const { toteId, orderId } = req.body;

  if (!toteId || !orderId) {
    return res.status(400).json({ error: "Missing toteId or orderId" });
  }

  try {
    const tote = await Tote.findById(toteId);
    const order = await Order.findById(orderId);

    if (!tote || !order) {
      return res.status(404).json({ error: "Tote or Order not found" });
    }

    // Unassign tote
    tote.assignedToOrder = null;
    tote.status = "available";
    await tote.save();

    // Remove tote from order's list
    order.totes = order.totes.filter((id) => id.toString() !== toteId);
    await order.save();

    res.json({ message: "Tote removed successfully", tote, order });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

const assignedTotes = async (req, res) => {
  const { orderId } = req.params;

  try {
    const assignedTotes = await Tote.find({
      assignedToOrder: new mongoose.Types.ObjectId(orderId),
  });
    res.json(assignedTotes);
  } catch (err) {
    console.error("Error fetching assigned totes:", err);
    res.status(500).json({ error: "Failed to fetch assigned totes" });
  }
}

module.exports = {
  getPickerOrders,
  getPickingOrder,
  pickItem,
  pickPlusItem,
  pickMinusItem,
  pickFlagItem,
  pickSubstituteItem,
  undoItem,
  scanBarcode,
  completePicking,
  getAvailableTotes,
  assignTote,
  removeTote,
  assignedTotes
};
