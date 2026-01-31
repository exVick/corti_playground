import { NextResponse } from "next/server";
import { getCortiClient } from "@/lib/corti";
import type { TranscriptSegment } from "@/types/corti";

export async function POST(request: Request) {
  try {
    const { interactionId, transcript, additionalContext } = await request.json();

    if (!interactionId) {
      return NextResponse.json({ error: "interactionId is required" }, { status: 400 });
    }

    const client = getCortiClient();

    // Build transcript text from segments for the context
    const transcriptText = (transcript as TranscriptSegment[])
      .filter((s) => s.final)
      .sort((a, b) => a.time.start - b.time.start)
      .map((s) => s.transcript)
      .join(" ");

    if (!transcriptText.trim()) {
      return NextResponse.json({ error: "No transcript content to summarize" }, { status: 400 });
    }

    // Prepend additional context if provided
    const contextParts: string[] = [];
    if (additionalContext && typeof additionalContext === "string" && additionalContext.trim()) {
      contextParts.push(`Additional context: ${additionalContext.trim()}`);
    }
    contextParts.push(transcriptText);
    const fullContext = contextParts.join("\n\n");

    const doc = await client.documents.create(interactionId, {
      templateKey: "soap",
      outputLanguage: "en",
      context: [
        {
          type: "string",
          data: fullContext,
        },
      ],
    });

    return NextResponse.json({
      document: {
        id: doc.id,
        name: doc.name,
        templateRef: doc.templateRef,
        sections: doc.sections.map((s) => ({
          key: s.key,
          name: s.name,
          text: s.text,
          sort: s.sort,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        outputLanguage: doc.outputLanguage,
      },
    });
  } catch (error: unknown) {
    console.error("Document generation failed:", error);
    const message = error instanceof Error ? error.message : "Failed to generate document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
