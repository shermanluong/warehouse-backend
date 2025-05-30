const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Driver = require('../models/driver.model');
const Tote = require('../models/tote.model');
const { adjustShopifyInventory, refundItem} = require('../services/shopify.service');

const mongoose = require('mongoose');
const { formatDate } = require('../utils/formateDate');

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
    const selectedDate = req.query.date || '';
    const pickerName = req.query.picker || '';
    const packerName = req.query.packer || '';

    const driversRaw = req.query.driver || req.query['driver[]'];
    const drivers = Array.isArray(driversRaw)
      ? driversRaw
      : driversRaw
        ? [driversRaw]
        : [];

    const tagsRaw = req.query.tag || req.query['tag[]'];
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw
      : tagsRaw
        ? [tagsRaw]
        : [];

    const textSearchQuery = {
      $and: [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
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
        },
        {
          tags: {
            $regex: formatDate(selectedDate),
            $options: 'i'
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

    if (drivers.length > 0) {
      additionalFilters.push({
        'delivery.driverMemberId': { $in: drivers.map(d => new RegExp(d, 'i')) }
      });
    }

    if (tags.length > 0) {
      additionalFilters.push({
        $or: tags.map(t => ({
          tags: { $regex: new RegExp(`(?:^|,\\s*)${t}(?:,|$)`, 'i') }
        }))
      });
    }

    // rest of your pipeline...
    const orders = await Order.aggregate([
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

      // Regroup orders
      {
        $group: {
          _id: '$_id',
          shopifyOrderId: { $first: '$shopifyOrderId' },
          name: { $first: '$name' },
          orderNumber: { $first: '$orderNumber' },
          status: { $first: '$status' },
          createdAt: { $first: '$createdAt' },
          customer: { $first: '$customer' },
          picker: { $first: '$picker' },
          packer: { $first: '$packer' },
          delivery: { $first: '$delivery' },
          adminNote: { $first: '$adminNote' },
          orderNote: { $first: '$orderNote' },
          lineItemCount: {$sum: {$size : '$lineItems'}},
          tags: {$first: '$tags'},
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
            {
              $sort: {
                'delivery.tripId': 1, // Sort tripId in ascending order (increase)
                'delivery.stopNumber': -1 // Sort stopNumber in descending order (decrease)
              }
            },
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

// Delete /api/admin/order
const deleteAllOrders = async (req, res) => {
  try {
    await Order.deleteMany({});
    res.json({message: 'All orders deleted successfully.'});
  } catch (error) {
    console.error('Error deleting all orders', error);
    res.status(500).json({error: 'Internal server error'});
  }
};

const deleteOrdersBydate = async (req, res) => {
  try {
    const selectedDate = req.query.date;
    if (!selectedDate) {
      return res.status(400).json({ error: 'Date query is required' });
    }

    const regex = new RegExp(formatDate(selectedDate), 'i');
    const result = await Order.deleteMany({ tags: { $regex: regex } });

    res.json({ message: `${result.deletedCount} orders deleted for date ${selectedDate}.` });
  } catch (error) {
    console.error('Error deleting orders by date:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch orders assigned to the picker (e.g., from query param or session)
const getApprovalOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const orders = await Order.aggregate([
      // Filter orders that have at least one line item with refund or subbed as true
      {
        $match: {
          approved: { $ne: true }, // Exclude already approved
          lineItems: {
            $elemMatch: {
              $or: [
                { refund: true },
                { subbed: true }
              ]
            }
          }
        }
      },

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

      // Project only lineItems where refund or subbed is true
      {
        $addFields: {
          lineItems: {
            $filter: {
              input: '$lineItems',
              as: 'item',
              cond: {
                $or: [
                  { $eq: ['$$item.refund', true] },
                  { $eq: ['$$item.subbed', true] }
                ]
              }
            }
          }
        }
      },

      // Regroup orders
      {
        $group: {
          _id: '$_id',
          shopifyOrderId: { $first: '$shopifyOrderId' },
          name: { $first: '$name' },
          orderNumber: { $first: '$orderNumber' },
          status: { $first: '$status' },
          createdAt: { $first: '$createdAt' },
          customer: { $first: '$customer' },
          picker: { $first: '$picker' },
          packer: { $first: '$packer' },
          delivery: { $first: '$delivery' },
          adminNote: { $first: '$adminNote' },
          orderNote: { $first: '$orderNote' },
          lineItems: { $first: '$lineItems' }, // include filtered items
          tags: { $first: '$tags' }
        }
      },

      // Pagination with total count
      {
        $facet: {
          data: [
            {
              $sort: {
                'delivery.tripId': 1,
                'delivery.stopNumber': -1
              }
            },
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

// Get /api/admin/approval/:id
const getApprovalOrder = async (req, res) => {
  const orderId = req.params.id;

  try {
    const objectId = new mongoose.Types.ObjectId(orderId);

    const order = await Order.aggregate([
      { $match: { _id: objectId } },
      { $unwind: "$lineItems" },

      // ✅ Only keep lineItems where refund or subbed is true
      {
        $match: {
          $or: [
            { "lineItems.refund": true },
            { "lineItems.subbed": true }
          ]
        }
      },

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

      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
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

const approveLineItem = async (req, res) => {
  const { id, shopifyLineItemId } = req.params;
  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Find the line item and validate it exists
    const lineItem = order.lineItems.find(item => 
      item.shopifyLineItemId.toString() === shopifyLineItemId.toString()
    );

    if (!lineItem) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    if (lineItem.refund === true) {
      const refundQuantity = lineItem.pickedStatus.damaged.quantity + lineItem.packedStatus.outOfStock.quantity;
      console.log(`Refund quantity: ${refundQuantity}`);
      //await refundItem(order.shopifyOrderId, shopifyLineItemId, refundQuantity);
    } else if (lineItem.subbed === true) {
      console.log(`Approved substitution for line item ${shopifyLineItemId}`);
      
      if ( lineItem.pickedStatus.damaged?.quantity > 0 ) {
        const damagedQuantity = lineItem.pickedStatus.damaged.quantity;
        console.log(`Decreasing original variant (damaged) inventory by: ${damagedQuantity}`);
        //await adjustShopifyInventory(lineItem.pickedStatus.damaged.variantId, -damagedQuantity);
      }

      if ( lineItem.pickedStatus.outOfStock?.quantity > 0 ) {
        const outOfStockQuantity = lineItem.pickedStatus.outOfStock.quantity;
        console.log(`Decreasing original variant (out of stock) inventory by: ${outOfStockQuantity}`);
        //await adjustShopifyInventory(lineItem.pickedStatus.outOfStock.variantId, -outOfStockQuantity);
      }
    }

    /*await Order.updateOne(
      { _id: id, 'lineItems.shopifyLineItemId': shopifyLineItemId.toString() },
      { $set: { 'lineItems.$.approved': true } }
    );*/

    res.json({ success: true, message: 'Item approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Approval failed' });
  }
};

const approveOrder = async (req, res) => {
  try {
    await Order.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Approval failed' });
  }
}

// Controller
const getProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';
  const sortField = req.query.sort || 'title';
  const sortOrder = req.query.order === 'desc' ? -1 : 1;
  const tag = req.query.tag;
  const vendor = req.query.vendor;
  const status = req.query.status;

  const query = {
    $and: [
      {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { 'variants.title': { $regex: search, $options: 'i' } },
          { 'variants.sku': { $regex: search, $options: 'i' } },
        ]
      }
    ]
  };

  if (tag) query.$and.push({ tags: tag });
  if (vendor) query.$and.push({ vendor });
  if (status) query.$and.push({ status });

  const total = await Product.countDocuments(query);

  const products = await Product.find(query)
    .sort({ [sortField]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ products, total });
};

const getProductVendors = async (req, res) => {
  try {
    const vendors = await Product.distinct('vendor');
    res.json({ vendors });
  } catch (err) {
    console.error('Failed to fetch vendors:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getProductStatuses = async (req, res) => {
  try {
    const statuses = await Product.distinct('status');
    res.json({ statuses });
  } catch (err) {
    console.error('Failed to fetch statuses:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json({ drivers });
  } catch (err) {
    console.error('Failed to fetch drivers:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const addTote = async (req, res) => {
  try {
    const tote = new Tote({name: req.body.name});
    await tote.save();
    res.status(201).json(tote);
  } catch (err) {
    res.status(400).json({error: err.message});
  }
};

module.exports = {
  getLogs,
  getDashboardStats,
  getOrders,
  deleteAllOrders,
  deleteOrdersBydate,
  getApprovalOrders,
  getApprovalOrder,
  approveOrder,
  approveLineItem,
  getOrder,
  getProducts,
  addOrderNote,
  addItemNote,
  getProductVendors,
  getProductStatuses,
  getDrivers,
  addTote
};
