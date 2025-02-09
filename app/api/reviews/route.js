import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import { Review, Reservation } from '../../../models';

// GET all reviews with filtering
export async function GET(request) {
  try {
    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const minRating = searchParams.get('minRating');
    const isVerified = searchParams.get('isVerified');
    const guestEmail = searchParams.get('email');

    // Build query
    let query = {};
    if (minRating) query.rating = { $gte: parseInt(minRating) };
    if (isVerified !== null) query.isVerified = isVerified === 'true';
    if (guestEmail) query['guest.email'] = guestEmail;

    const reviews = await Review.find(query)
      .populate({
        path: 'reservation',
        populate: {
          path: 'room',
          model: 'Room'
        }
      });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST create new review
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();

    // Verify reservation exists and belongs to the guest
    const reservation = await Reservation.findById(body.reservation);
    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    if (reservation.guest.email !== body.guest.email) {
      return NextResponse.json(
        { error: 'Review can only be created by the guest who made the reservation' },
        { status: 403 }
      );
    }

    // Check if review already exists for this reservation
    const existingReview = await Review.findOne({ reservation: body.reservation });
    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists for this reservation' },
        { status: 400 }
      );
    }

    const review = await Review.create(body);
    
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 