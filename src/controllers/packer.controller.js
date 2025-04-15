const mongoose = require('mongoose');
const Order = require('../models/order.model');
// const locate2UService = require('../services/locate2u.service'); // optional
// const photoUploader = require('../services/photo.service');       // optional
// const slackNotifier = require('../services/slack.service');       // optional

// Get picked orders assigned to the packer
const getPickedOrders = async (req, res) => {
  try {
    const { userId } = req.user;

    let match = {
      $and: [
        { status: { $in: ['picked', 'packing'] } }
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
  finalisePack,
};
