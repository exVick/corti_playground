"use client";

import type { AppState, TranscriptSegment, Fact } from "@/types/corti";
import { useEffect, useRef, useMemo } from "react";

interface RecordingViewProps {
  appState: AppState;
  transcriptSegments: TranscriptSegment[];
  facts: Fact[];
  recordingDuration: number;
  audioLevel: number;
  error: string | null;
  additionalContext: string;
  selectedLanguage: string;
  onAdditionalContextChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onGenerateSummary: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function AudioRings({
  level,
  isRecording,
}: {
  level: number;
  isRecording: boolean;
}) {
  const boosted = Math.min(level * 2.5, 1);
  const rings = [
    { scale: 1 + boosted * 0.5, opacity: 0.08 + boosted * 0.12, delay: 0 },
    { scale: 1 + boosted * 0.35, opacity: 0.1 + boosted * 0.1, delay: 50 },
    { scale: 1 + boosted * 0.2, opacity: 0.15 + boosted * 0.05, delay: 100 },
  ];

  if (!isRecording) return null;

  return (
    <>
      {rings.map((ring, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full bg-red-400 pointer-events-none"
          style={{
            transform: `scale(${ring.scale})`,
            opacity: ring.opacity,
            transition: `transform 120ms ease-out ${ring.delay}ms, opacity 120ms ease-out ${ring.delay}ms`,
          }}
        />
      ))}
    </>
  );
}

function WaveformBars({ level }: { level: number }) {
  const barCount = 32;
  const weights = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const center = (barCount - 1) / 2;
      const distFromCenter = Math.abs(i - center) / center;
      const baseHeight = 1 - distFromCenter * 0.7;
      const variation = Math.sin(i * 2.7 + 1.3) * 0.2 + 0.8;
      return baseHeight * variation;
    });
  }, []);

  return (
    <div className="flex items-center justify-center gap-[2px] h-12">
      {weights.map((weight, i) => {
        const h = Math.max(3, weight * level * 48);
        return (
          <div
            key={i}
            className="w-[2.5px] rounded-full bg-red-400"
            style={{
              height: `${h}px`,
              opacity: 0.4 + level * 0.6,
              transition: "height 80ms ease-out, opacity 80ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}

export function RecordingView({
  appState,
  transcriptSegments,
  facts,
  recordingDuration,
  audioLevel,
  error,
  additionalContext,
  selectedLanguage,
  onAdditionalContextChange,
  onLanguageChange,
  onStartRecording,
  onStopRecording,
  onGenerateSummary,
}: RecordingViewProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (appState === "recording") {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcriptSegments, appState]);

  const isIdle = appState === "idle";
  const isConnecting = appState === "connecting";
  const isRecording = appState === "recording";
  const isStopping = appState === "stopping";
  const isRecorded = appState === "recorded";
  const isGenerating = appState === "generating";

  const activeFacts = facts.filter((f) => !f.isDiscarded);
  const showContextBox = isIdle || isRecorded || isGenerating;

  // Available languages for transcription
  const languages = [
    { code: "en", name: "English" },
    { code: "bg", name: "Bulgarian" },
    { code: "es", name: "Spanish" },
    { code: "de", name: "German" },
    { code: "fr", name: "French" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "sv", name: "Swedish" },
    { code: "no", name: "Norwegian" },
    { code: "pl", name: "Polish" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      {/* Top nav bar */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Medical Scribe
            </h1>
            <p className="text-xs text-gray-400">
              AI-powered clinical documentation
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            {error}
          </div>
        )}

        {/* Language selection */}
        {showContextBox && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"
                />
              </svg>
              <span className="text-xs font-medium text-gray-500">
                Transcription Language
              </span>
            </div>
            <div className="p-5">
              <select
                id="language-select"
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={!isIdle}
                className="w-full px-4 py-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                {isIdle
                  ? "Select the primary language for audio transcription"
                  : isRecording || isStopping || isConnecting
                    ? "Language cannot be changed during recording"
                    : "Select language before starting your next recording"}
              </p>
            </div>
          </div>
        )}

        {/* Context card — full width */}
        {showContextBox && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <span className="text-xs font-medium text-gray-500">
                Session Context
              </span>
            </div>
            <div className="p-5">
              <textarea
                id="additional-context"
                value={additionalContext}
                onChange={(e) => onAdditionalContextChange(e.target.value)}
                placeholder="Patient info, reason for visit, prior history, or any notes to include in the clinical summary..."
                disabled={isGenerating}
                rows={3}
                className="w-full text-sm text-gray-800 bg-transparent resize-none focus:outline-none placeholder:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* Action card — full width, centered content */}
        {(isIdle || isConnecting || isRecorded || isGenerating) && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-10">
            <div className="flex flex-col items-center gap-5">
              {isIdle && (
                <>
                  <button
                    onClick={onStartRecording}
                    className="group relative w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-200/50 hover:shadow-xl hover:shadow-red-300/50 hover:scale-105 cursor-pointer"
                    aria-label="Start recording"
                  >
                    <svg
                      className="w-11 h-11 text-white transition-transform group-hover:scale-110"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                      />
                    </svg>
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      Start Recording
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tap to begin capture
                    </p>
                  </div>
                </>
              )}

              {isConnecting && (
                <>
                  <div className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">
                    Setting up session...
                  </p>
                </>
              )}

              {(isRecorded || isGenerating) && (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg
                      className="w-5 h-5 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    <span>
                      Recording complete &middot;{" "}
                      {formatDuration(recordingDuration)}
                    </span>
                  </div>
                  <button
                    onClick={onGenerateSummary}
                    disabled={isGenerating}
                    className="px-10 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200/50 hover:shadow-md hover:shadow-blue-300/50 cursor-pointer"
                  >
                    {isGenerating ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Generating Summary...
                      </span>
                    ) : (
                      "Generate Summary"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Recording state — full width hero */}
        {(isRecording || isStopping) && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-8">
              <div className="flex flex-col items-center gap-5">
                {isRecording && (
                  <>
                    <div className="relative flex items-center justify-center w-36 h-36">
                      <AudioRings level={audioLevel} isRecording />
                      <button
                        onClick={onStopRecording}
                        className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-200/50 cursor-pointer transition-transform hover:scale-105"
                        aria-label="Stop recording"
                      >
                        <div className="w-7 h-7 bg-white rounded-sm" />
                      </button>
                    </div>
                    <WaveformBars level={audioLevel} />
                    <div className="text-center">
                      <p className="text-2xl font-mono text-gray-700 tabular-nums tracking-wider">
                        {formatDuration(recordingDuration)}
                      </p>
                      <p className="text-sm text-red-500 flex items-center justify-center gap-2 mt-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        Recording in progress
                      </p>
                    </div>
                  </>
                )}

                {isStopping && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-gray-400 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-600">
                        Finalizing transcript...
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Processing remaining audio
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live transcript panel */}
        {transcriptSegments.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                  />
                </svg>
                <span className="text-xs font-medium text-gray-500">
                  {isRecording ? "Live Transcript" : "Transcript"}
                </span>
                <span className="text-xs text-gray-400">
                  ({transcriptSegments.filter((s) => s.final).length} segments)
                </span>
              </div>
              {activeFacts.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full">
                  {activeFacts.length} fact
                  {activeFacts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="p-5 max-h-80 overflow-y-auto">
              <div className="space-y-2.5">
                {transcriptSegments.map((seg) => (
                  <div key={`${seg.time.start}-${seg.time.end}`} className="flex gap-3">
                    <span className="text-xs font-medium text-blue-500 mt-0.5 shrink-0 w-20">
                      Speaker {seg.speakerId >= 0 ? seg.speakerId + 1 : "?"}
                    </span>
                    <p
                      className={`text-sm leading-relaxed ${
                        seg.final ? "text-gray-800" : "text-gray-400 italic"
                      }`}
                    >
                      {seg.transcript}
                    </p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state for idle — helpful tips */}
        {isIdle && transcriptSegments.length === 0 && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
                  />
                ),
                title: "Record",
                desc: "Capture the conversation with your microphone",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                  />
                ),
                title: "Transcribe",
                desc: "Real-time transcription with speaker diarization",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                ),
                title: "Generate",
                desc: "SOAP notes, ICD codes, and clinical facts",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="flex flex-col items-center text-center p-5 rounded-xl bg-white/60 border border-gray-100"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <svg
                    className="w-5 h-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    {step.icon}
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {step.title}
                </p>
                <p className="text-xs text-gray-400 mt-1">{step.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
