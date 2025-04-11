const Order = require('../models/order.model');

// Fetch orders assigned to the picker (e.g., from query param or session)
const getPickerOrders = async (req, res) => {
  try {
    const { pickerId } = req.query;
    const orders = await Order.find({ status: 'new', pickerId });
    res.json({ orders });
  } catch (err) {
    console.error('Error fetching picker orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Scan item → validate barcode, mark picked, flag or substitute if needed
const scanAndUpdateItem = async (req, res) => {
  try {
    const { orderId, barcode, flags = [], substitution = null, pickerId } = req.body;

    const order = await Order.findOne({ shopifyOrderId: orderId });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const item = order.lineItems.find(item => item.barcode === barcode);

    if (!item) return res.status(400).json({ error: 'Item not found for barcode' });

    item.picked = true;
    item.flags = flags;
    item.substitution = substitution;

    // Optionally update the pickerId if it's the first scan
    if (!order.pickerId) {
      order.pickerId = pickerId;
    }

    // Check if all items picked → update status
    const allPicked = order.lineItems.every(i => i.picked);
    if (allPicked) {
      order.status = 'picked';
    }

    order.updatedAt = new Date();
    await order.save();

    res.json({ message: 'Item updated', order });
  } catch (err) {
    console.error('Error scanning item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
};

module.exports = {
  getPickerOrders,
  scanAndUpdateItem,
};
