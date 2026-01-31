"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AppState,
  TranscriptSegment,
  Fact,
  GeneratedDocument,
  PredictedCode,
  ExtractedFact,
} from "@/types/corti";
import { RecordingView } from "@/components/RecordingView";
import { ResultsView } from "@/components/ResultsView";
import { AudioRecorder } from "@/components/AudioRecorder";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<
    TranscriptSegment[]
  >([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [additionalContext, setAdditionalContext] = useState("");
  const [predictedCodes, setPredictedCodes] = useState<PredictedCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [extractedFacts, setExtractedFacts] = useState<ExtractedFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Start Recording ---
  const handleStartRecording = useCallback(async () => {
    setError(null);
    setTranscriptSegments([]);
    setFacts([]);
    setGeneratedDoc(null);
    setRecordingDuration(0);
    setAudioLevel(0);
    setPredictedCodes([]);
    setExtractedFacts([]);
    setAppState("connecting");

    try {
      // Create session via server API
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create session");
      }
      const session = await res.json();
      setInteractionId(session.interactionId);

      // Initialize AudioRecorder
      const recorder = new AudioRecorder({
        onTranscript: (segments) => {
          // Corti stream uses the interaction ID as segment ID for ALL
          // segments, so we cannot use seg.id as a unique key.
          // Use time.start as a unique key instead (each segment has
          // a distinct start time).
          setTranscriptSegments((prev) => {
            const map = new Map(
              prev.map((s) => [`${s.time.start}-${s.time.end}`, s])
            );
            for (const seg of segments) {
              const key = `${seg.time.start}-${seg.time.end}`;
              map.set(key, seg);
            }
            return Array.from(map.values()).sort(
              (a, b) => a.time.start - b.time.start
            );
          });
        },
        onFacts: (newFacts) => {
          setFacts((prev) => {
            const map = new Map(prev.map((f) => [f.id, f]));
            newFacts.forEach((f) => map.set(f.id, f));
            return Array.from(map.values());
          });
        },
        onError: (err) => setError(err),
        onSessionReady: () => {
          setAppState("recording");
          timerRef.current = setInterval(() => {
            setRecordingDuration((d) => d + 1);
          }, 1000);
        },
        onEnded: () => {
          // Stream ended — no action needed
        },
        onAudioLevel: (level) => setAudioLevel(level),
      });

      recorderRef.current = recorder;
      await recorder.start(session.websocketUrl, session.token);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
      setAppState("idle");
    }
  }, []);

  // --- Stop Recording ---
  const handleStopRecording = useCallback(async () => {
    setAppState("stopping");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await recorderRef.current?.stop();
    recorderRef.current = null;
    setAudioLevel(0);

    setAppState("recorded");
  }, []);

  // --- Generate Summary ---
  const handleGenerateSummary = useCallback(async () => {
    if (!interactionId) return;
    setAppState("generating");
    setError(null);

    try {
      const res = await fetch("/api/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionId,
          transcript: transcriptSegments,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate document");
      }

      const { document: doc } = await res.json();
      setGeneratedDoc(doc);
      setAppState("results");

      // Fetch ICD codes using the generated summary text
      // This is more reliable than raw transcript for code prediction
      const summaryText = doc.sections
        .sort((a: { sort: number }, b: { sort: number }) => a.sort - b.sort)
        .map((s: { name: string; text: string }) => `${s.name}: ${s.text}`)
        .join("\n\n");

      if (summaryText.trim()) {
        fetchCodes(summaryText);
        fetchFacts(summaryText);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Document generation failed"
      );
      setAppState("recorded"); // Allow retry
    }
  }, [interactionId, transcriptSegments, additionalContext]);

  // --- Fetch ICD Codes ---
  const fetchCodes = useCallback(async (text: string) => {
    setCodesLoading(true);
    try {
      const res = await fetch("/api/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        console.error("Code prediction failed:", res.status);
        return;
      }

      const data = await res.json();
      // The API returns codes (highest confidence bundle) and candidates (rank-sorted)
      const allCodes: PredictedCode[] = [
        ...(data.codes || []),
        ...(data.candidates || []),
      ];
      // Deduplicate by code string (codes may appear in both lists)
      const seen = new Set<string>();
      const uniqueCodes = allCodes.filter((c) => {
        if (seen.has(c.code)) return false;
        seen.add(c.code);
        return true;
      });
      setPredictedCodes(uniqueCodes);
    } catch (err) {
      console.error("Code prediction error:", err);
    } finally {
      setCodesLoading(false);
    }
  }, []);

  // --- Fetch Facts (REST) ---
  const fetchFacts = useCallback(async (text: string) => {
    setFactsLoading(true);
    try {
      const res = await fetch("/api/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        console.error("Facts extraction failed:", res.status);
        return;
      }

      const data = await res.json();
      setExtractedFacts(data.facts || []);
    } catch (err) {
      console.error("Facts extraction error:", err);
    } finally {
      setFactsLoading(false);
    }
  }, []);

  // --- New Recording ---
  const handleNewRecording = useCallback(() => {
    setAppState("idle");
    setInteractionId(null);
    setTranscriptSegments([]);
    setFacts([]);
    setGeneratedDoc(null);
    setRecordingDuration(0);
    setError(null);
    setAudioLevel(0);
    setAdditionalContext("");
    setPredictedCodes([]);
    setCodesLoading(false);
    setExtractedFacts([]);
    setFactsLoading(false);
  }, []);

  // --- Render ---
  if (appState === "results" && generatedDoc) {
    return (
      <ResultsView
        transcriptSegments={transcriptSegments}
        generatedDoc={generatedDoc}
        facts={facts}
        extractedFacts={extractedFacts}
        factsLoading={factsLoading}
        predictedCodes={predictedCodes}
        codesLoading={codesLoading}
        additionalContext={additionalContext}
        onNewRecording={handleNewRecording}
      />
    );
  }

  return (
    <RecordingView
      appState={appState}
      transcriptSegments={transcriptSegments}
      facts={facts}
      recordingDuration={recordingDuration}
      audioLevel={audioLevel}
      error={error}
      additionalContext={additionalContext}
      onAdditionalContextChange={setAdditionalContext}
      onStartRecording={handleStartRecording}
      onStopRecording={handleStopRecording}
      onGenerateSummary={handleGenerateSummary}
    />
  );
}
