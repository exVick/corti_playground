// --- WebSocket Config ---
export interface StreamConfig {
  type: "config";
  configuration: {
    transcription: {
      primaryLanguage: string;
      isDiarization: boolean;
      isMultichannel: boolean;
      participants: Array<{
        channel: number;
        role: "doctor" | "patient" | "multiple";
      }>;
    };
    mode: {
      type: "facts" | "transcription";
      outputLocale?: string;
    };
  };
}

// --- WebSocket Incoming Messages ---
export interface TranscriptSegment {
  id: string;
  transcript: string;
  time: { start: number; end: number };
  final: boolean;
  speakerId: number;
  participant?: { channel: number };
}

export interface TranscriptMessage {
  type: "transcript";
  data: TranscriptSegment[];
}

export interface Fact {
  id: string;
  text: string;
  group: string;
  groupId: string;
  isDiscarded: boolean;
  source: "core" | "user" | "system";
  createdAt: string;
  updatedAt: string | null;
}

export interface FactsMessage {
  type: "facts";
  fact: Fact[];
}

export interface ConfigAccepted {
  type: "CONFIG_ACCEPTED";
  sessionId?: string;
}

export interface ConfigDenied {
  type: "CONFIG_DENIED";
  reason?: string;
}

export interface EndedMessage {
  type: "ENDED";
}

export interface UsageMessage {
  type: "usage";
  credits: number;
}

export interface StreamError {
  type: "error";
  error: {
    id: string;
    title: string;
    status: number;
    details: string;
    doc: string;
  };
}

export interface FlushedMessage {
  type: "flushed";
}

export type StreamMessage =
  | TranscriptMessage
  | FactsMessage
  | ConfigAccepted
  | ConfigDenied
  | EndedMessage
  | UsageMessage
  | StreamError
  | FlushedMessage;

// --- API Response Types ---
export interface SessionResponse {
  interactionId: string;
  websocketUrl: string;
  token: string;
}

export interface DocumentSection {
  key: string;
  name: string;
  text: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedDocument {
  id: string;
  name: string;
  templateRef: string;
  sections: DocumentSection[];
  outputLanguage: string;
}

// --- ICD Code Prediction ---
export interface CodeEvidence {
  contextIndex: number;
  text: string;
}

export interface PredictedCode {
  code: string;
  display: string;
  system: string;
  evidences?: CodeEvidence[];
}

export interface CodePredictionResult {
  codes: PredictedCode[];
  candidates: PredictedCode[];
}

// --- REST Facts Extraction ---
export interface ExtractedFact {
  group: string;
  value: string;
}

export interface FactsExtractionResult {
  facts: ExtractedFact[];
  outputLanguage: string;
}

// --- App State ---
export type AppState = "idle" | "connecting" | "recording" | "stopping" | "recorded" | "generating" | "results";
