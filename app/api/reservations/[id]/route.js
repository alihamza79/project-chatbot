import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import { Reservation, Room } from '../../../../models';

// GET single reservation
export async function GET(request, { params }) {
  try {
    await connectDB();
    const reservation = await Reservation.findById(params.id)
      .populate('room')
      .populate('addOns.service');
    
    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT update reservation
export async function PUT(request, { params }) {
  try {
    await connectDB();
    const body = await request.json();
    
    const reservation = await Reservation.findById(params.id);
    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // If status is being updated to 'cancelled', free up the room
    if (body.status === 'cancelled' && reservation.status !== 'cancelled') {
      await Room.findByIdAndUpdate(reservation.room, { status: 'available' });
    }
    
    // If changing dates, check for availability
    if (body.checkIn || body.checkOut) {
      const overlappingReservation = await Reservation.findOne({
        _id: { $ne: params.id },
        room: reservation.room,
        status: { $nin: ['cancelled'] },
        $or: [
          {
            checkIn: { $lte: new Date(body.checkOut || reservation.checkOut) },
            checkOut: { $gte: new Date(body.checkIn || reservation.checkIn) }
          }
        ]
      });

      if (overlappingReservation) {
        return NextResponse.json(
          { error: 'Room is already booked for these dates' },
          { status: 400 }
        );
      }
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).populate('room').populate('addOns.service');
    
    return NextResponse.json(updatedReservation);
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE reservation
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    
    const reservation = await Reservation.findById(params.id);
    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Free up the room if reservation is active
    if (reservation.status !== 'cancelled') {
      await Room.findByIdAndUpdate(reservation.room, { status: 'available' });
    }

    await Reservation.findByIdAndDelete(params.id);
    
    return NextResponse.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 