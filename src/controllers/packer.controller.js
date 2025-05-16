const mongoose = require('mongoose');
const Order = require('../models/order.model');
const Tote = require('../models/tote.model');
const { Types } = require('mongoose');
const ObjectId = Types.ObjectId;
const { adjustShopifyInventory} = require('../services/shopify.service');
const { refundItem } = require('../services/shopify.service');
const createNotification = require('../utils/createNotification');
const { getVariantDisplayTitle } = require('../utils/getVariantTitle');
const { addLocate2uStopNoteService} = require('../services/locate2u.service');
const { sendSlackNotification } = require('../services/slack.service');
const axios = require('axios');

// const locate2UService = require('../services/locate2u.service'); // optional
// const photoUploader = require('../services/photo.service');       // optional
// const slackNotifier = require('../services/slack.service');       // optional

// Get picked orders assigned to the packer
const getPickedOrders = async (req, res) => {
  try {
    const { userId } = req.user;
    
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
        $lookup: {
          from: "totes", // make sure this matches your actual MongoDB collection name
          localField: "totes",
          foreignField: "_id",
          as: "totes"
        }
      },
      {
        $project: {
          shopifyOrderId: 1,
          name: 1,
          orderNumber: 1,
          status: 1,
          pickerId: 1,
          packerId: 1,
          totes: {
            $map: {
              input: "$totes",
              as: "tote",
              in: {
                _id: "$$tote._id",
                name: "$$tote.name"
              }
            }
          },
          adminNote: { $ifNull: ["$adminNote", null] },
          orderNote: 1,
          createdAt: 1,
          customer: 1,
          lineItemCount: { $size: "$lineItems" },
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
      { 
        $unwind: {
          path: "$productInfo",
          preserveNullAndEmptyArrays: true 
        }
      },

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
          orderName: { $first: "$orderName" },
          orderNote: { $first: "$orderNote" },
          adminNote: { $first: "$adminNote" },
          status: { $first: "$status" },
          pickerId: { $first: "$pickerId" },
          packerId: { $first: "$packerId" },
          createdAt: { $first: "$createdAt" },
          customer: { $first: "$customer" },
          delivery: { $first: "$delivery" },
          photos: { $first: "$photos" },
          lineItems: { $push: "$lineItems" },
        }
      },
      // Sort by SKU
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
  const { shopifyLineItemId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.packed = false;
    item.packedStatus = {...item.packedStatus, verified: {quantity: 0}, damaged: {quantity: 0}, outOfStock: {quantity: 0}};
    item.subbed = false;

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
  const { shopifyLineItemId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.pickedStatus.damaged.subbed = null;
    item.pickedStatus.outOfStock.subbed = null;

    item.subbed = false;

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
  const { shopifyLineItemId } = req.body;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.subbed = true;
    await order.save();
    //await adjustShopifyInventory(item.variantId, -1); // 🔻 Decrease original variant
    res.json({ message: 'Confirm Sub Item successfully' });
  } catch (err) {
    console.error("Confirm error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

const refundLineItem = async (req, res) => {
  try {
    const { id, shopifyOrderId, shopifyLineItemId, quantity } = req.body;

    if (!shopifyOrderId || !shopifyLineItemId || !quantity) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // const refundResult = await refundItem(shopifyOrderId, shopifyLineItemId, quantity);
    const refundResult = {};

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const title = await getVariantDisplayTitle(item.productId, item.variantId);

    await createNotification({
      type: 'REFUND',
      message: `${title} was refunded in order ${order.name}.`,
      userRoles: ['admin'],
      relatedOrderId: order._id,
      relatedProductId: item.productId,
      relatedVariantId: item.variantId
    });

    // Update refund field
    item.packed = true;
    item.refund = true;

    // Save the order with the updated line item
    await order.save();

    res.json({
      message: "Refund processed successfully",
      data: order, // Return the updated order
    });
  } catch (error) {
    console.log('Error processing refund:', error);
    res.status(500).json({ message: "Error processing refund", error: error.message });
  }
};

const savePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { photoUrl, fileId } = req.body;

    if (!photoUrl || !fileId) {
      return res.status(400).json({ message: 'Photo URL and fileId are required' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.photos = order.photos || [];
    order.photos.push({ photoUrl, fileId }); // ⬅️ match schema

    await order.save();

    res.json({ message: 'Photo saved', photos: order.photos });
  } catch (err) {
    console.error('Error saving photo:', err);
    res.status(500).json({ message: 'Server error saving photo' });
  }
};

const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ message: 'fileId is required' });
    }

    // Delete from ImageKit
    const imagekitRes = await axios.delete('https://api.imagekit.io/v1/files/' + fileId, {
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.IMAGEKIT_PRIVATE_KEY + ':').toString('base64')}`
      }
    });

    // Remove from Order in DB
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.photos = (order.photos || []).filter(photo => photo.fileId !== fileId);
    await order.save();

    res.json({ message: 'Photo deleted successfully', remainingPhotos: order.photos });

  } catch (err) {
    console.error('Delete Photo Error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Error deleting photo' });
  }
}

//PATCH /api/packer/order/:id/pack-plus
const packPlusItem =  async (req, res) => {
  const { id } = req.params;
  const { shopifyLineItemId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (item.packed === true) {
    return res.status(404).json({ message: 'Item has already packed' });
  }

  if (item.packedStatus.verified.quantity < item.pickedStatus.verified.quantity) {
    item.packedStatus.verified.quantity += 1;
  }

  const packedStatus = item.packedStatus;
  const totalPackedQuantity = packedStatus.verified.quantity + packedStatus.damaged.quantity + packedStatus.outOfStock.quantity;
  if (totalPackedQuantity >= item.quantity) {
    item.packed = true;
  }

  if (order.status == "picked" ) order.status = "packing";
  await order.save();

  res.json({ success: true, item });
}

//PATCH /api/packer/order/:id/pack-minus
const packMinusItem =  async (req, res) => {
  const { id } = req.params;
  const { shopifyLineItemId } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const item = order.lineItems.find(i => i.shopifyLineItemId === shopifyLineItemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  if (item.packedStatus.verified.quantity > 0) {
    item.packedStatus.verified.quantity  -= 1;
  }

  const packedStatus = item.packedStatus;
  const totalPackedQuantity = packedStatus.verified.quantity + packedStatus.damaged.quantity + packedStatus.outOfStock.quantity;

  if (totalPackedQuantity < item.quantity) {
    item.packed = false;
  }

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

const isPackingComplete = (lineItems) => {
  return lineItems.every(item => 
    item.picked 
  );
};

// POST /api/picker/order/:id/complete-picking
const completePacking = async (req, res) => {
  try {
    const { id } = req.params;
    const { boxCount } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isPackingComplete(order.lineItems)) {
      return res.status(400).json({ message: 'All items must be packed to complete packing.' });
    }

    const note = boxCount === 1
      ? `The order has been packed in ${boxCount} box`
      : `The order has been packed in ${boxCount} boxes`;

    if (order.delivery && order.delivery.stopId) {
      await addLocate2uStopNoteService(order.delivery.stopId, note);
    }

    await sendSlackNotification("Slack Test!");
    order.boxCount = boxCount;
    order.status = 'packed';
    await order.save();

    for (const t of order.totes) {
      const tote = await Tote.findById(t);
      if (tote) {
        tote.status = 'available';
        tote.assignedToOrder = null;
        await tote.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error in completePacking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getPickedOrders,
  getPackingOrder,
  packItem,
  undoItem,
  cancelSubItem,
  confirmSubItem,
  refundLineItem, 
  packPlusItem,
  packMinusItem,
  startPacking,
  savePhoto,
  deletePhoto,
  completePacking,
};
