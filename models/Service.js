import mongoose from 'mongoose';

const MenuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    enum: ['appetizer', 'main', 'dessert', 'beverage', 'special'],
    required: true,
  },
  cuisine: {
    type: String,
    enum: ['international', 'local', 'italian', 'chinese', 'indian', 'mediterranean'],
  },
  spicyLevel: {
    type: Number,
    min: 0,
    max: 3,
  },
  dietaryInfo: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'kosher'],
  }],
  allergens: [{
    type: String,
    enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'shellfish', 'fish'],
  }],
  image: String,
  isAvailable: {
    type: Boolean,
    default: true,
  },
  preparationTime: {
    type: Number, // in minutes
    default: 20,
  },
  popularityScore: {
    type: Number,
    default: 0,
  },
});

const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['restaurant', 'spa', 'gym', 'laundry', 'roomService', 'transport', 'tour', 'childcare', 'business'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  availability: {
    days: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    }],
    startTime: String,
    endTime: String,
    maxCapacity: Number,
    currentBookings: Number,
  },
  location: {
    floor: Number,
    section: String,
    capacity: Number,
    tables: [{
      number: String,
      seats: Number,
      isAvailable: Boolean,
    }],
  },
  menu: [MenuItemSchema],
  specialOffers: [{
    name: String,
    description: String,
    discount: Number,
    validFrom: Date,
    validUntil: Date,
    isActive: Boolean,
  }],
  staffMembers: [{
    name: String,
    role: String,
    specialization: String,
    availability: [{
      day: String,
      startTime: String,
      endTime: String,
    }],
  }],
  ratings: {
    average: {
      type: Number,
      default: 0,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  images: [String],
  requirements: {
    advanceBooking: {
      type: Number,
      default: 0,
    }, // hours required for advance booking
    minimumGuests: {
      type: Number,
      default: 1,
    },
    maximumGuests: Number,
    dresscode: String,
    ageRestriction: Number,
  },
}, {
  timestamps: true,
});

export default ServiceSchema; 