import mongoose from 'mongoose';

const ReservationSchema = new mongoose.Schema({
  guest: {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: String,
    specialRequests: String,
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  numberOfGuests: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentDetails: {
    stripeSessionId: String,
    transactionId: String,
    paidAmount: Number,
    paidAt: Date,
  },
  status: {
    type: String,
    enum: ['confirmed', 'checked-in', 'checked-out', 'cancelled'],
    default: 'confirmed',
  },
  addOns: [{
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    quantity: Number,
    price: Number,
  }],
}, {
  timestamps: true,
}); 