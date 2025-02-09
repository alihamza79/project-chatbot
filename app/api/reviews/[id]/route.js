import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/mongodb';
import { Review } from '../../../../models';

// GET single review
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const review = await Review.findById(params.id)
      .populate({
        path: 'reservation',
        populate: {
          path: 'room',
          model: 'Room'
        }
      });

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error('Error fetching review:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT update review
export async function PUT(request, { params }) {
  try {
    await connectDB();
    
    const body = await request.json();
    
    // Find and update the review
    const review = await Review.findById(params.id);
    
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Only allow updating content, rating, and response
    const allowedUpdates = {
      content: body.content,
      rating: body.rating,
      hotelResponse: body.hotelResponse
    };

    const updatedReview = await Review.findByIdAndUpdate(
      params.id,
      allowedUpdates,
      { new: true, runValidators: true }
    );

    return NextResponse.json(updatedReview);
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE review
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    
    const review = await Review.findByIdAndDelete(params.id);
    
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Review deleted successfully' }
    );
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 