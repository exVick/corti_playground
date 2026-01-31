import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/corti";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const token = await getAccessToken();
    const env = process.env.CORTI_ENV || "eu";
    const tenant = process.env.CORTI_TENANT || "base";

    const response = await fetch(
      `https://api.${env}.corti.app/v2/tools/extract-facts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Tenant-Name": tenant,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: [{ type: "text", text }],
          outputLanguage: "en",
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Facts extraction failed:", response.status, errBody);
      return NextResponse.json(
        { error: `Facts extraction failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Facts extraction error:", error);
    const message =
      error instanceof Error ? error.message : "Facts extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
