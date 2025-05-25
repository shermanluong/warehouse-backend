const bcrypt = require('bcrypt');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// Admin gets all users
const getUsers = async (req, res) => {
    const users = await User.find({}, '-passwordHash');
    res.json(users);
};
  
const upsertUser = async (req, res) => {
    const { userName, realName, role } = req.body;
    
    try {
      // Try to find existing user
      const existingUser = await User.findOne({ userName });
  
      if (existingUser) {
        // Update existing user
        const updatedUser = await User.findByIdAndUpdate(
          existingUser._id,
          { 
            realName, 
            role,
            // Include other fields you might want to update
          },
          { new: true } // Return the updated document
        );
        
        return res.json({ 
          message: 'User updated successfully',
          user: updatedUser 
        });
      } else {
        // Register new user
        const defaultPassword = '1';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
  
        const newUser = new User({
          userName,
          realName,
          role,
          passwordHash,
          active: true,
        });
  
        await newUser.save();
        
        return res.status(201).json({ 
          message: 'User created successfully',
          user: newUser 
        });
      }
    } catch (error) {
      console.error('Error in upsertUser:', error);
      return res.status(500).json({ 
        error: 'An error occurred while processing the user' 
      });
    }
};
  
  // Admin deletes user
  const deleteUser = async (req, res) => {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
  
    res.json({ message: 'User deleted' });
};

const getProfile = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.userId); // convert string to ObjectId
    const user = await User.findById(userObjectId); // Only fetch needed fields

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const saveProfile = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.userId); // Auth middleware should set req.user.userId

    // Only allow certain fields to be updated
    const { realName, userName, role, active } = req.body;
    const update = { realName, userName, role, active };
    console.log(update);
    // Find and update user
    const updatedUser = await User.findByIdAndUpdate(
      userObjectId,
      { $set: update },
      { new: true, runValidators: true}
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const updatedUser = await User.findByIdAndUpdate(
      userObjectId,
      { $set: { passwordHash: hash } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getUsers,
  upsertUser,
  deleteUser,
  getProfile,
  saveProfile,
  changePassword
};