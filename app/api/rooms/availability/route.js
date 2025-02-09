import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import { Room, Reservation } from '../../../../models';

export async function GET(request) {
  try {
    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const guests = parseInt(searchParams.get('guests')) || 1;
    const roomType = searchParams.get('type');

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Check-in and check-out dates are required' },
        { status: 400 }
      );
    }

    // Convert dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      );
    }

    // Find existing reservations that overlap with the requested dates
    const existingReservations = await Reservation.find({
      $and: [
        { checkIn: { $lt: checkOutDate } },
        { checkOut: { $gt: checkInDate } },
        { status: { $nin: ['cancelled'] } }
      ]
    }).select('room');

    // Get reserved room IDs
    const reservedRoomIds = existingReservations.map(res => res.room);

    // Build query for available rooms
    let query = {
      _id: { $nin: reservedRoomIds },
      status: 'available',
      maxOccupancy: { $gte: guests }
    };

    if (roomType) {
      query.type = roomType;
    }

    // Find available rooms
    const availableRooms = await Room.find(query);

    return NextResponse.json({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      availableRooms,
      total: availableRooms.length
    });

  } catch (error) {
    console.error('Error checking room availability:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 