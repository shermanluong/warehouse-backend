// src/controllers/shopify.controller.js
const { getOrders } = require('../services/shopify.service');
const Order = require('../models/order.model');
const User  = require('../models/user.model');

const assignLeastBusyPicker = async () => {
  const picker = await User.findOne({ role: 'picker', active: true })
    .sort({ 'stats.currentLineItemsAssigned': 1 }) // Least busy first
    .exec();

  return picker;
};

const fetchAndStoreOrders = async (req, res) => {
  const orders = await getOrders(); // Assuming this pulls unfulfilled orders from Shopify

  for (const order of orders) {
    const customer = order.customer;
    const picker = await assignLeastBusyPicker();

    await Order.findOneAndUpdate(
      { shopifyOrderId: order.id },
      {
        $set: {
          shopifyOrderId: order.id,
          status: 'new',
          pickerId: picker._id,
          lineItems: order.line_items.map(item => ({
            productId: item.sku || item.variant_id,
            name: item.title,
            quantity: item.quantity,
            barcode: item.barcode,
            customerNote: item.note
          })),
          customer: customer
            ? {
                id: customer.id,
                email: customer.email,
                first_name: customer.first_name,
                last_name: customer.last_name,
                phone: customer.phone,
                default_address: customer.default_address
                  ? {
                      address1: customer.default_address.address1,
                      address2: customer.default_address.address2,
                      city: customer.default_address.city,
                      province: customer.default_address.province,
                      country: customer.default_address.country,
                      zip: customer.default_address.zip
                    }
                  : {}
              }
            : null
        }
      },
      { upsert: true }
    );
    
    const newLineItemCount = order.line_items.reduce((acc, item) => acc + item.quantity, 0);
    
    await User.findByIdAndUpdate(picker._id, {
      $inc: { 'stats.currentLineItemsAssigned': newLineItemCount }
    });
  }

  res.json({ message: 'Synced', count: orders.length });
};

module.exports = { fetchAndStoreOrders };
