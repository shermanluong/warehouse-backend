const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');

// Get logs of all orders (e.g. substitutions, refunds, etc.)
const getLogs = async (req, res) => {
  const orders = await Order.find({}, { logs: 1 });
  const logs = orders.flatMap(order => order.logs.map(log => ({ orderId: order._id, ...log })));
  res.json({ logs });
};

// Optional: dashboard summary
const getDashboardStats = async (req, res) => {
  const newOrders       = await Order.find({ status: 'new' });
  const pickingOrders   = await Order.find({ status: 'picking' });
  const pickedOrders    = await Order.find({ status: 'picked' });
  const packingOrders   = await Order.find({ status: 'packing' });
  const packedOrders    = await Order.find({ status: 'packed' });
  const deliveredOrders = await Order.find({ status: 'delivered' });

  res.json({
    newOrders: newOrders.length,
    pickingOrders: pickingOrders.length,
    pickedOrders: pickedOrders.length,
    packingOrders: packingOrders.length,
    packedOrders: packedOrders.length,
    deliveredOrders: deliveredOrders.length,
  });
};

//PATCH /admin/order/:orderId/add-order-note
const addOrderNote = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ message: 'Note is required' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { adminNote: note },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order: updatedOrder });
  } catch (err) {
    console.error('Error adding order note:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

//PATCH /admin/order/:orderId/add-item-note
const addItemNote = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, note } = req.body;

    if (!productId || !note) {
      return res.status(400).json({ message: 'productId and note are required' });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Find and update the matching line item
    const item = order.lineItems.find(item => item.productId.toString() === productId);

    if (!item) {
      return res.status(404).json({ message: 'Product not found in order' });
    }

    item.adminNote = note;
    await order.save();
    res.json({ item });
  } catch (err) {
    console.error('Error adding item note:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Fetch orders assigned to the picker (e.g., from query param or session)
const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'desc' ? -1 : 1;

    const pickerName = req.query.picker || '';
    const packerName = req.query.packer || '';

    const textSearchQuery = {
      $or: [
        { shopifyOrderId: { $regex: search, $options: 'i' } },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$customer.first_name', ' ', '$customer.last_name'] },
              regex: search,
              options: 'i'
            }
          }
        }
      ]
    };

    const additionalFilters = [];

    if (pickerName) {
      additionalFilters.push({ 'picker.realName': { $regex: pickerName, $options: 'i' } });
    }

    if (packerName) {
      additionalFilters.push({ 'packer.realName': { $regex: packerName, $options: 'i' } });
    }

    const orders = await Order.aggregate([
      { $sort: { [sortField]: sortOrder } },

      // Lookup picker
      {
        $lookup: {
          from: 'users',
          localField: 'pickerId',
          foreignField: '_id',
          as: 'picker'
        }
      },
      { $unwind: { path: '$picker', preserveNullAndEmptyArrays: true } },

      // Lookup packer
      {
        $lookup: {
          from: 'users',
          localField: 'packerId',
          foreignField: '_id',
          as: 'packer'
        }
      },
      { $unwind: { path: '$packer', preserveNullAndEmptyArrays: true } },

      // Unwind lineItems
      { $unwind: '$lineItems' },

      // Lookup product info
      {
        $lookup: {
          from: 'products',
          let: {
            pid: '$lineItems.productId',
            vid: '$lineItems.variantId'
          },
          pipeline: [
            { $match: { $expr: { $eq: ['$shopifyProductId', '$$pid'] } } },
            {
              $addFields: {
                variant: {
                  $first: {
                    $filter: {
                      input: '$variants',
                      as: 'v',
                      cond: { $eq: ['$$v.shopifyVariantId', '$$vid'] }
                    }
                  }
                }
              }
            }
          ],
          as: 'productInfo'
        }
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },

      // Regroup orders
      {
        $group: {
          _id: '$_id',
          shopifyOrderId: { $first: '$shopifyOrderId' },
          status: { $first: '$status' },
          createdAt: { $first: '$createdAt' },
          customer: { $first: '$customer' },
          picker: { $first: '$picker' },
          packer: { $first: '$packer' },
          adminNote: { $first: '$adminNote' },
          orderNote: { $first: '$orderNote' },
        }
      },

      // Text search
      { $match: textSearchQuery },

      // Optional filters
      ...(additionalFilters.length > 0 ? [{ $match: { $and: additionalFilters } }] : []),

      // Pagination with total count
      {
        $facet: {
          data: [
            { $sort: { [sortField]: sortOrder } },
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ],
          totalCount: [{ $count: 'count' }]
        }
      },

      {
        $project: {
          data: 1,
          total: { $arrayElemAt: ['$totalCount.count', 0] }
        }
      }
    ]);

    const result = orders[0] || { data: [], total: 0 };

    res.json({
      orders: result.data.map(order => ({
        ...order,
        lineItemCount: order.lineItems?.length || 0,
        picker: { name: order.picker?.realName },
        packer: { name: order.packer?.realName }
      })),
      total: result.total
    });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get /api/admin/order/:id
const getOrder = async (req, res) => {
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

// Controller
const getProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';
  const sortField = req.query.sort || 'title';
  const sortOrder = req.query.order === 'desc' ? -1 : 1;
  const tag = req.query.tag;

  const query = {
    $or: [
      { title: { $regex: search, $options: 'i' } },
      { 'variants.title': { $regex: search, $options: 'i' } },
      { 'variants.sku': { $regex: search, $options: 'i' } },
    ]
  };

  if (tag) query.tags = tag;

  const total = await Product.countDocuments(query);

  const products = await Product.find(query)
    .sort({ [sortField]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ products, total });
};

module.exports = {
  getLogs,
  getDashboardStats,
  getOrders,
  getOrder,
  getProducts,
  addOrderNote,
  addItemNote
};
