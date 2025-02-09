import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import { Reservation, Room } from '../../../models';

// GET all reservations with filtering
export async function GET(request) {
  try {
    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const guestEmail = searchParams.get('email');

    // Build query
    let query = {};
    if (status) query.status = status;
    if (guestEmail) query['guest.email'] = guestEmail;
    if (from || to) {
      query.checkIn = {};
      if (from) query.checkIn.$gte = new Date(from);
      if (to) query.checkIn.$lte = new Date(to);
    }

    const reservations = await Reservation.find(query)
      .populate('room')
      .populate('addOns.service');

    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST create new reservation
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();

    // Check if room exists and is available
    const room = await Room.findById(body.room);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    if (room.status !== 'available') {
      return NextResponse.json(
        { error: 'Room is not available' },
        { status: 400 }
      );
    }

    // Check for overlapping reservations
    const overlappingReservation = await Reservation.findOne({
      room: body.room,
      status: { $nin: ['cancelled'] },
      $or: [
        {
          checkIn: { $lte: new Date(body.checkOut) },
          checkOut: { $gte: new Date(body.checkIn) }
        }
      ]
    });

    if (overlappingReservation) {
      return NextResponse.json(
        { error: 'Room is already booked for these dates' },
        { status: 400 }
      );
    }

    // Calculate total amount
    const nights = Math.ceil(
      (new Date(body.checkOut) - new Date(body.checkIn)) / (1000 * 60 * 60 * 24)
    );
    body.totalAmount = room.pricePerNight * nights;

    // Create reservation
    const reservation = await Reservation.create(body);
    
    // Update room status
    await Room.findByIdAndUpdate(body.room, { status: 'reserved' });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 