import { NextResponse } from "next/server";
import { getCortiClient, getAccessToken } from "@/lib/corti";

export async function POST() {
  try {
    const [client, token] = await Promise.all([
      Promise.resolve(getCortiClient()),
      getAccessToken(),
    ]);

    const interaction = await client.interactions.create({
      encounter: {
        identifier: `enc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: "in-progress",
        type: "consultation",
      },
    });

    return NextResponse.json({
      interactionId: interaction.interactionId,
      websocketUrl: interaction.websocketUrl,
      token,
    });
  } catch (error: unknown) {
    console.error("Session creation failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
