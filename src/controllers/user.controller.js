const bcrypt = require('bcrypt');
const User = require('../models/user.model');

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

module.exports = {
    getUsers,
    upsertUser,
    deleteUser,
};