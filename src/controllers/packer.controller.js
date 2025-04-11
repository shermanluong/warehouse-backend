const Order = require('../models/order.model');
// const locate2UService = require('../services/locate2u.service'); // optional
// const photoUploader = require('../services/photo.service');       // optional
// const slackNotifier = require('../services/slack.service');       // optional

// Get picked orders assigned to the packer
const getPickedOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: 'picked' });
    res.json({ orders });
  } catch (err) {
    console.error('Error fetching picked orders:', err);
    res.status(500).json({ error: 'Internal server error' });
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
  finalisePack,
};
