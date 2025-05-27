import { NextResponse } from "next/server";
import { db } from "../../../server/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10");

    // Get total count
    const total = await db.lockProfile.count();

    // If no page parameter is provided, return all locks
    if (!page) {
      const locks = await db.lockProfile.findMany({
        orderBy: {
          streetNumber: "asc",
        },
      });

      return NextResponse.json({
        locks,
      });
    }

    // Handle paginated request
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * pageSize;

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
        page: pageNum,
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
