import { NextResponse } from "next/server";
import { db } from "../../../server/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10");
    const skip = (page - 1) * pageSize;

    // Get total count
    const total = await db.lockProfile.count();

    // Get paginated locks
    const locks = await db.lockProfile.findMany({
      orderBy: {
        streetNumber: "asc",
      },
      skip,
      take: pageSize,
    });

    return NextResponse.json({
      locks,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching locks:", error);
    return NextResponse.json(
      { error: "Failed to fetch locks" },
      { status: 500 },
    );
  }
}
