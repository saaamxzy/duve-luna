import { NextResponse } from "next/server";
import { db } from "../../../../server/db";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const { fullPropertyName, lockId, lockCode } = body;

    // Validate lock code format if provided
    if (lockCode && !lockCode.match(/^#[0-9]{4}$/)) {
      return NextResponse.json(
        { error: "Lock code must start with # followed by 4 digits" },
        { status: 400 },
      );
    }

    const updatedLock = await db.lockProfile.update({
      where: { id: params.id },
      data: {
        fullPropertyName,
        lockId,
        lockCode,
      },
    });

    return NextResponse.json(updatedLock);
  } catch (error) {
    console.error("Error updating lock:", error);
    return NextResponse.json(
      { error: "Failed to update lock" },
      { status: 500 },
    );
  }
}
