// src/controllers/shopify.controller.js
const { getOrders } = require('../services/shopify.service');
const Order = require('../models/order.model');

const fetchAndStoreOrders = async (req, res) => {
  const orders = await getOrders();
  
  for (const order of orders) {
        await Order.findOneAndUpdate(
            { shopifyOrderId: order.id },
            {
            $set: {
                shopifyOrderId: order.id,
                lineItems: order.line_items.map(item => ({
                productId: item.sku || item.variant_id,
                name: item.title,
                quantity: item.quantity,
                barcode: item.barcode,
                customerNote: item.note
                }))
                // other fields like photoUrl, pickerId will be filled later by your app
            }
            },
            { upsert: true }
        );
    }

  res.json({ message: 'Synced', count: orders.length });
};

module.exports = { fetchAndStoreOrders };
