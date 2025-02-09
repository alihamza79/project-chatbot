import mongoose from 'mongoose';

// Room Model
const Room = mongoose.models.Room || mongoose.model('Room', require('./Room').default);

// Reservation Model
const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', require('./Reservation').default);

// Service Model
const Service = mongoose.models.Service || mongoose.model('Service', require('./Service').default);

// Review Model
const Review = mongoose.models.Review || mongoose.model('Review', require('./Review').default);

export { Room, Reservation, Service, Review }; 