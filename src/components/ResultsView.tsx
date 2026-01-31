"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  TranscriptSegment,
  GeneratedDocument,
  Fact,
  PredictedCode,
  ExtractedFact,
} from "@/types/corti";

interface ResultsViewProps {
  transcriptSegments: TranscriptSegment[];
  generatedDoc: GeneratedDocument;
  facts: Fact[];
  extractedFacts: ExtractedFact[];
  factsLoading: boolean;
  predictedCodes: PredictedCode[];
  codesLoading: boolean;
  additionalContext: string;
  onNewRecording: () => void;
}

// Group streaming facts by their group field
function groupFacts(facts: Fact[]): Map<string, Fact[]> {
  const grouped = new Map<string, Fact[]>();
  for (const fact of facts) {
    const group = fact.group || "Other";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(fact);
  }
  return grouped;
}

// Group extracted facts by their group field
function groupExtractedFacts(facts: ExtractedFact[]): Map<string, ExtractedFact[]> {
  const grouped = new Map<string, ExtractedFact[]>();
  for (const fact of facts) {
    const group = fact.group || "Other";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(fact);
  }
  return grouped;
}

// Code ranking badge color — top codes (from "codes" bundle) get green, rest get neutral
function rankBadgeStyle(index: number): string {
  if (index < 3) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (index < 6) return "bg-blue-50 text-blue-800 border-blue-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

// Tab types
type LeftTab = "transcript" | "context";
type RightTab = "summary" | "facts" | "codes";

export function ResultsView({
  transcriptSegments,
  generatedDoc,
  facts,
  extractedFacts,
  factsLoading,
  predictedCodes,
  codesLoading,
  additionalContext,
  onNewRecording,
}: ResultsViewProps) {
  const [splitPosition, setSplitPosition] = useState(40);
  const [leftTab, setLeftTab] = useState<LeftTab>("transcript");
  const [activeTab, setActiveTab] = useState<RightTab>("summary");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPosition(Math.min(Math.max(pct, 20), 80));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const finalSegments = transcriptSegments
    .filter((s) => s.final)
    .sort((a, b) => a.time.start - b.time.start);

  const sortedSections = [...generatedDoc.sections].sort(
    (a, b) => a.sort - b.sort
  );

  const activeFacts = facts.filter((f) => !f.isDiscarded);
  const groupedFacts = groupFacts(activeFacts);
  const groupedExtracted = groupExtractedFacts(extractedFacts);

  const totalFactsCount = activeFacts.length + extractedFacts.length;

  const tabs: { key: RightTab; label: string; count?: number }[] = [
    { key: "summary", label: "Summary" },
    { key: "facts", label: "Facts", count: totalFactsCount },
    { key: "codes", label: "ICD Codes", count: predictedCodes.length },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Results</h1>
        <button
          onClick={onNewRecording}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
        >
          New Recording
        </button>
      </header>

      {/* Split panels */}
      <div
        ref={containerRef}
        className="flex flex-1 overflow-hidden"
        style={{ cursor: isDragging.current ? "col-resize" : undefined }}
      >
        {/* Left panel — Tabbed (Transcript / Context) */}
        <div
          className="flex flex-col overflow-hidden bg-white"
          style={{ width: `${splitPosition}%` }}
        >
          {/* Left tab bar */}
          <div className="flex border-b border-gray-200 px-4 shrink-0">
            <button
              onClick={() => setLeftTab("transcript")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                leftTab === "transcript"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Transcript
            </button>
            {additionalContext && (
              <button
                onClick={() => setLeftTab("context")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  leftTab === "context"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Context
              </button>
            )}
          </div>

          {/* Left tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {leftTab === "transcript" && (
              <div className="space-y-3">
                {finalSegments.map((seg) => (
                  <div key={`${seg.time.start}-${seg.time.end}`} className="flex gap-3">
                    <span className="text-xs font-medium text-blue-500 mt-0.5 shrink-0 w-20">
                      Speaker {seg.speakerId >= 0 ? seg.speakerId + 1 : "?"}
                    </span>
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {seg.transcript}
                    </p>
                  </div>
                ))}
                {finalSegments.length === 0 && (
                  <p className="text-sm text-gray-400 italic">
                    No transcript segments available.
                  </p>
                )}
              </div>
            )}

            {leftTab === "context" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900 whitespace-pre-wrap">
                  {additionalContext}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 bg-gray-100 hover:bg-blue-300 cursor-col-resize shrink-0 transition-colors relative group"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
        </div>

        {/* Right panel — Tabbed content */}
        <div
          className="flex flex-col overflow-hidden bg-gray-50"
          style={{ width: `${100 - splitPosition}%` }}
        >
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 bg-white px-4 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                      activeTab === tab.key
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Summary tab */}
            {activeTab === "summary" && (
              <div className="space-y-6">
                {sortedSections.map((section) => (
                  <div key={section.key}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      {section.name}
                    </h3>
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {section.text}
                    </div>
                  </div>
                ))}
                {sortedSections.length === 0 && (
                  <p className="text-sm text-gray-400 italic">
                    No summary sections generated.
                  </p>
                )}
              </div>
            )}

            {/* Facts tab */}
            {activeTab === "facts" && (
              <div className="space-y-6">
                {/* Extracted facts (REST API) */}
                {factsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
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
                    Extracting clinical facts...
                  </div>
                ) : extractedFacts.length > 0 ? (
                  Array.from(groupedExtracted.entries()).map(([group, facts]) => (
                    <div key={`extracted-${group}`}>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                        {group}
                      </h3>
                      <div className="space-y-2">
                        {facts.map((fact, i) => (
                          <div
                            key={`extracted-${group}-${i}`}
                            className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <p className="text-sm text-gray-800 flex-1 min-w-0">
                              {fact.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : null}

                {/* Streaming facts (from real-time session) */}
                {activeFacts.length > 0 && (
                  <>
                    {extractedFacts.length > 0 && (
                      <div className="border-t border-gray-200 pt-4">
                        <p className="text-xs text-gray-400 mb-4">Real-time facts</p>
                      </div>
                    )}
                    {Array.from(groupedFacts.entries()).map(([group, groupFacts]) => (
                      <div key={`streaming-${group}`}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                          {group}
                        </h3>
                        <div className="space-y-2">
                          {groupFacts.map((fact) => (
                            <div
                              key={fact.id}
                              className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800">
                                  {fact.text}
                                </p>
                                <span className="text-xs text-gray-400 mt-1 inline-block">
                                  {fact.source}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Empty state */}
                {!factsLoading && extractedFacts.length === 0 && activeFacts.length === 0 && (
                  <p className="text-sm text-gray-400 italic">
                    No clinical facts extracted.
                  </p>
                )}
              </div>
            )}

            {/* ICD Codes tab */}
            {activeTab === "codes" && (
              <div className="space-y-3">
                {codesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
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
                    Predicting ICD codes...
                  </div>
                ) : predictedCodes.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    No ICD codes predicted.
                  </p>
                ) : (
                  predictedCodes.map((code, i) => (
                    <div
                      key={`${code.system}-${code.code}-${i}`}
                      className={`p-4 rounded-lg border ${rankBadgeStyle(i)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono font-bold">
                              {code.code}
                            </span>
                            <span className="text-xs opacity-70 uppercase">
                              {code.system}
                            </span>
                          </div>
                          <p className="text-sm">{code.display}</p>
                        </div>
                        <span className="text-xs font-medium shrink-0 px-2 py-0.5 rounded-full bg-white/60">
                          #{i + 1}
                        </span>
                      </div>
                      {code.evidences && code.evidences.length > 0 && (
                        <p className="mt-2 text-xs opacity-70 italic">
                          {code.evidences.map((e) => e.text).join("; ")}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
