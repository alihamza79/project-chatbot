import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  type: { type: String, required: true },
  capacity: { type: Number, required: true },
  pricePerNight: { type: Number, required: true },
  amenities: { type: [String], default: [] },
  features: { type: [String], default: [] },
  description: { type: String },
  images: { type: [String], default: [] },
  status: { type: String, default: 'Available' },
  floor: { type: Number },
  size: { type: String },
  bedType: { type: String },
  smoking: { type: Boolean, default: false },
  maintenance: { type: Object }
});

const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
export default Room; 