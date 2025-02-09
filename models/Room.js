import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    enum: ['single', 'double', 'suite'],
    required: true,
  },
  pricePerNight: {
    type: Number,
    required: true,
  },
  amenities: [{
    type: String,
  }],
  maxOccupancy: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'reserved'],
    default: 'available',
  },
  floor: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  images: [{
    type: String, // URLs to room images
  }],
  features: [{
    name: String,
    description: String,
  }],
}, {
  timestamps: true,
}); 