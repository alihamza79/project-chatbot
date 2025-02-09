import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
  },
  guest: {
    name: String,
    email: String,
  },
  categories: {
    cleanliness: {
      type: Number,
      min: 1,
      max: 5,
    },
    service: {
      type: Number,
      min: 1,
      max: 5,
    },
    comfort: {
      type: Number,
      min: 1,
      max: 5,
    },
    location: {
      type: Number,
      min: 1,
      max: 5,
    },
    value: {
      type: Number,
      min: 1,
      max: 5,
    },
  },
  images: [{
    type: String,
  }],
  response: {
    comment: String,
    respondedAt: Date,
    respondedBy: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

const Review = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
export default Review; 