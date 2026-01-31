import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/corti";

export async function POST(request: Request) {
  try {
    const { text, documentId } = await request.json();

    if (!text && !documentId) {
      return NextResponse.json(
        { error: "Either text or documentId is required" },
        { status: 400 }
      );
    }

    const token = await getAccessToken();
    const env = process.env.CORTI_ENV || "eu";
    const tenant = process.env.CORTI_TENANT || "base";

    // Build context array with typed items per API docs
    const context = text
      ? [{ type: "text", text }]
      : [{ type: "documentId", documentId }];

    // Call Corti Predict Codes REST API
    const response = await fetch(
      `https://api.${env}.corti.app/v2/tools/coding/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Tenant-Name": tenant,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context,
          system: ["icd10cm"],
          maxCandidates: 10,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Code prediction failed:", response.status, errBody);

      // If documentId-based prediction failed, don't retry — caller should
      // provide text fallback
      return NextResponse.json(
        { error: `Code prediction failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Code prediction error:", error);
    const message =
      error instanceof Error ? error.message : "Code prediction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
