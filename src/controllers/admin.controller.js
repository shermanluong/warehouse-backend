const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const Order = require('../models/order.model');

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

// Fetch orders assigned to the picker (e.g., from query param or session)
const getOrders = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users', // MongoDB collection name for users
          localField: 'pickerId',
          foreignField: '_id',
          as: 'picker'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'packerId',
          foreignField: '_id',
          as: 'packer'
        }
      },
      {
        $unwind: {
          path: '$picker',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: '$packer',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          shopifyOrderId: 1,
          status: 1,
          createdAt: 1,
          customer: 1,
          lineItemCount: { $size: '$lineItems' },
          picker: { name: '$picker.realName',},
          packer: { name: '$packer.realName',}
        }
      }
    ]);

    res.json(orders);
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin gets all users
const getUsers = async (req, res) => {
  const users = await User.find({}, '-passwordHash');
  res.json(users);
};

// Admin registers user (default password)
const registerUser = async (req, res) => {
  const { email, name, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ error: 'User already exists' });

  const defaultPassword = 'changeme123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const user = new User({
    email,
    name,
    role,
    passwordHash,
    active: true, // set to false if you want manual approval
  });

  await user.save();
  res.json({ message: 'User created', userId: user._id });
};

// Admin updates user info
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, role, active } = req.body;

  const updated = await User.findByIdAndUpdate(id, { name, role, active }, { new: true });
  if (!updated) return res.status(404).json({ error: 'User not found' });

  res.json({ message: 'User updated', user: updated });
};

// Admin deletes user
const deleteUser = async (req, res) => {
  const { id } = req.params;
  const deleted = await User.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: 'User not found' });

  res.json({ message: 'User deleted' });
};

module.exports = {
  getLogs,
  getDashboardStats,
  getOrders,
  getUsers,
  registerUser,
  updateUser,
  deleteUser,
};
