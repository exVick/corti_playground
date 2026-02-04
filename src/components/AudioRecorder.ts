import type {
  StreamConfig,
  StreamMessage,
  TranscriptSegment,
  Fact,
} from "@/types/corti";

export interface AudioRecorderCallbacks {
  onTranscript: (segments: TranscriptSegment[]) => void;
  onFacts: (facts: Fact[]) => void;
  onError: (error: string) => void;
  onSessionReady: () => void;
  onEnded: () => void;
  onAudioLevel: (level: number) => void;
}

export interface AudioRecorderOptions extends AudioRecorderCallbacks {
  language: string;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private websocket: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private callbacks: AudioRecorderCallbacks;
  private language: string;
  private configAccepted = false;
  private analyser: AnalyserNode | null = null;
  private audioCtx: AudioContext | null = null;
  private animFrameId: number | null = null;
  private stopping = false;

  constructor(options: AudioRecorderOptions) {
    this.callbacks = options;
    this.language = options.language;
  }

  async start(websocketUrl: string, token: string): Promise<void> {
    this.stopping = false;

    // Request microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Set up audio analyser for level metering
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.startLevelMonitoring();

    // Connect WebSocket — append token to URL
    const separator = websocketUrl.includes("?") ? "&" : "?";
    const wsUrl = `${websocketUrl}${separator}token=Bearer ${encodeURIComponent(token)}`;
    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      const config: StreamConfig = {
        type: "config",
        configuration: {
          transcription: {
            primaryLanguage: this.language,
            isDiarization: true,
            isMultichannel: false,
            participants: [{ channel: 0, role: "multiple" }],
          },
          mode: {
            type: "facts",
            outputLocale: this.language,
          },
        },
      };
      this.websocket!.send(JSON.stringify(config));
    };

    this.websocket.onmessage = (event: MessageEvent) => {
      try {
        const message: StreamMessage = JSON.parse(event.data as string);
        this.handleMessage(message);
      } catch {
        // Ignore non-JSON messages
      }
    };

    this.websocket.onerror = () => {
      // Only report errors if we're not in the middle of stopping
      if (!this.stopping) {
        this.callbacks.onError("WebSocket connection error");
      }
    };

    this.websocket.onclose = (event) => {
      // Only report unexpected disconnections — not during intentional stop
      if (!this.stopping && !event.wasClean && this.configAccepted) {
        this.callbacks.onError("Connection lost unexpectedly");
      }
      // Don't call cleanup() from onclose — let stop() handle it
      // Only auto-cleanup if we're not already stopping
      if (!this.stopping) {
        this.cleanup();
      }
    };
  }

  private startLevelMonitoring(): void {
    const tick = () => {
      if (!this.analyser) return;
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      // RMS-style average of frequency bins, normalized to 0–1
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length) / 255;
      this.callbacks.onAudioLevel(rms);
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private handleMessage(message: StreamMessage): void {
    switch (message.type) {
      case "CONFIG_ACCEPTED":
        this.configAccepted = true;
        this.startRecording();
        this.callbacks.onSessionReady();
        break;

      case "CONFIG_DENIED":
        this.callbacks.onError(
          `Configuration denied: ${message.reason || "Unknown reason"}`
        );
        this.cleanup();
        break;

      case "transcript":
        this.callbacks.onTranscript(message.data);
        break;

      case "facts":
        this.callbacks.onFacts(message.fact);
        break;

      case "error":
        this.callbacks.onError(message.error.details || message.error.title);
        break;

      case "ENDED":
        this.callbacks.onEnded();
        break;

      case "flushed":
      case "usage":
        break;
    }
  }

  private startRecording(): void {
    if (!this.stream || !this.websocket) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (
        event.data.size > 0 &&
        this.websocket?.readyState === WebSocket.OPEN &&
        this.configAccepted
      ) {
        this.websocket.send(event.data);
      }
    };

    this.mediaRecorder.start(500);
  }

  async stop(): Promise<void> {
    this.stopping = true;

    // Stop level monitoring immediately
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Flush any buffered audio from MediaRecorder before stopping it
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.requestData();
      // Give the ondataavailable event time to fire and send data
      await new Promise((resolve) => setTimeout(resolve, 200));
      this.mediaRecorder.stop();
    }

    if (this.websocket?.readyState === WebSocket.OPEN) {
      // Send flush to get any pending transcript segments
      this.websocket.send(JSON.stringify({ type: "flush" }));

      // Wait for the flushed response or timeout after 8s
      await new Promise<void>((resolve) => {
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 8000);

        if (this.websocket) {
          this.websocket.onmessage = (event: MessageEvent) => {
            try {
              const message = JSON.parse(event.data as string);
              this.handleMessage(message);

              if (message.type === "flushed") {
                clearTimeout(timeout);
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              }
            } catch {
              // Ignore non-JSON messages
            }
          };
        }

        // Also resolve if websocket already done
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      });

      // Now send end
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: "end" }));
      }
    }

    // Brief wait for ENDED message
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.cleanup();
  }

  private cleanup(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.analyser = null;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;

    if (this.websocket && this.websocket.readyState !== WebSocket.CLOSED) {
      this.websocket.close();
    }
    this.websocket = null;
    this.configAccepted = false;
    this.stopping = false;
  }
}
