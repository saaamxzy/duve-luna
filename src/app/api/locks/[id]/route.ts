import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../server/db";

export async function GET(request: NextRequest) {
  try {
    // Extract the id param from the URL
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();

    const lock = await db.lockProfile.findUnique({
      where: { id },
    });

    if (!lock) {
      return NextResponse.json(
        { error: "Lock not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(lock);
  } catch (error) {
    console.error("Error fetching lock:", error);
    return NextResponse.json(
      { error: "Failed to fetch lock" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const data = await request.json();

    // Validate lock code format if provided
    if (data.lockCode && !data.lockCode.match(/^#\d{4}$/)) {
      return NextResponse.json(
        { error: "Lock code must start with # followed by 4 digits" },
        { status: 400 }
      );
    }

    const updatedLock = await db.lockProfile.update({
      where: { id },
      data: {
        fullPropertyName: data.fullPropertyName,
        lockId: data.lockId,
        lockCode: data.lockCode,
      },
    });

    return NextResponse.json(updatedLock);
  } catch (error) {
    console.error("Error updating lock:", error);
    return NextResponse.json(
      { error: "Failed to update lock" },
      { status: 500 }
    );
  }
}
