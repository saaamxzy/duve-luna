import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "../../../../server/db";

interface LockProfileUpdate {
  fullPropertyName?: string;
  lockId?: string | null;
  lockCode?: string | null;
}

function isLockProfileUpdate(data: unknown): data is LockProfileUpdate {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (
    "fullPropertyName" in obj &&
    obj.fullPropertyName !== undefined &&
    typeof obj.fullPropertyName !== "string"
  ) {
    return false;
  }
  if (
    "lockId" in obj &&
    obj.lockId !== undefined &&
    typeof obj.lockId !== "string" &&
    obj.lockId !== null
  ) {
    return false;
  }
  if (
    "lockCode" in obj &&
    obj.lockCode !== undefined &&
    typeof obj.lockCode !== "string" &&
    obj.lockCode !== null
  ) {
    return false;
  }
  return true;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const lock = await db.lockProfile.findUnique({
      where: { id: params.id },
      include: {
        keyboardPasswords: {
          orderBy: {
            startDate: 'desc'
          }
        }
      }
    });

    if (!lock) {
      return new NextResponse("Lock not found", { status: 404 });
    }

    return NextResponse.json({ lock });
  } catch (error) {
    console.error("Error fetching lock details:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Extract the id param from the URL
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();
    const data: unknown = await request.json();
    if (!isLockProfileUpdate(data)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    // Validate lock code format if provided
    if (
      typeof data.lockCode === "string" &&
      !/^#\d{4}$/.exec(data.lockCode)
    ) {
      return NextResponse.json(
        { error: "Lock code must start with # followed by 4 digits" },
        { status: 400 }
      );
    }
    const updatedLock = await db.lockProfile.update({
      where: { id: id ?? undefined },
      data: {
        fullPropertyName: data.fullPropertyName ?? undefined,
        lockId: data.lockId ?? undefined,
        lockCode: data.lockCode ?? undefined,
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
