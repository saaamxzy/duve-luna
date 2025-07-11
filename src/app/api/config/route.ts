import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ConfigService } from "~/server/config";
import type { ConfigValues } from "~/server/config";

export async function GET() {
  try {
    const config = await ConfigService.getAll();
    const descriptions = ConfigService.getConfigDescriptions();

    return NextResponse.json({
      success: true,
      data: {
        values: config,
        descriptions,
      },
    });
  } catch (error) {
    console.error("Error fetching configuration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch configuration" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { values: ConfigValues };
    const { values } = body;

    if (!values || typeof values !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid configuration values" },
        { status: 400 },
      );
    }

    // Validate that all keys are valid configuration keys
    const validKeys = Object.keys(ConfigService.getConfigDescriptions());
    const invalidKeys = Object.keys(values).filter(
      (key) => !validKeys.includes(key),
    );

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid configuration keys: ${invalidKeys.join(", ")}`,
        },
        { status: 400 },
      );
    }

    await ConfigService.setMultiple(values);

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating configuration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update configuration" },
      { status: 500 },
    );
  }
}
