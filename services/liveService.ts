
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { UserSettings, EyeState, Emotion, VideoState, UserLocation, AppMode } from "../types";
import { getAudioContext, float32ToInt16, downsampleBuffer, arrayBufferToBase64, int16ToFloat32, base64ToArrayBuffer } from "../utils/audioUtils";

const customTools: FunctionDeclaration[] = [
  {
    name: "play_youtube_video",
    description: "Search and play a video or music on YouTube.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        search_query: { type: Type.STRING, description: "The title or keywords of the video to play" }
      },
      required: ["search_query"]
    }
  },
  {
    name: "set_reminder",
    description: "Set a timer or reminder for the user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        delay_minutes: { type: Type.NUMBER, description: "Minutes from now to alert" },
        label: { type: Type.STRING, description: "What to remind the user about" }
      },
      required: ["delay_minutes", "label"]
    }
  },
  {
    name: "enter_deep_sleep",
    description: "Enter deep sleep mode (Always On Display) when the user says goodnight or wants to stop interacting.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  },
  {
    name: "open_settings",
    description: "Open the settings menu when the user asks to open settings, configure app, or change API key (Mở cài đặt).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  },
  {
    name: "report_language_change",
    description: "Report the detected language when it changes during translation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: { type: Type.STRING, description: "The detected language name (e.g., Vietnamese, English)" }
      },
      required: ["language"]
    }
  }
];

const LANGUAGE_NAMES: { [key: string]: string } = {
  'vi': 'Vietnamese', 'en': 'English', 'ja': 'Japanese', 'ko': 'Korean',
  'zh': 'Chinese (Mandarin)', 'hi': 'Hindi (Indian)', 'ru': 'Russian',
  'fr': 'French', 'de': 'German', 'es': 'Spanish', 'it': 'Italian',
  'pt': 'Portuguese', 'th': 'Thai', 'id': 'Indonesian', 'ar': 'Arabic'
};

export class LiveService {
  private ai: GoogleGenAI;
  private session: any = null;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;

  // Filters
  private lowPassFilter: BiquadFilterNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;

  private stream: MediaStream | null = null;
  private nextStartTime = 0;
  private audioSources = new Set<AudioBufferSourceNode>();
  private isInterrupted = false;

  private currentInputTranscription = "";
  private currentOutputTranscription = "";

  // Store settings locally for audio graph config
  private currentSettings: UserSettings | null = null;

  public onStateChange: (state: EyeState) => void = () => { };
  public onVolumeChange: (volume: number) => void = () => { };
  public onTranscript: (text: string, isUser: boolean, isFinal: boolean) => void = () => { };
  public onVideoCommand: (video: VideoState) => void = () => { };
  public onDeepSleepCommand: () => void = () => { };
  public onOpenSettingsCommand: () => void = () => { };
  public onError: (message: string) => void = () => { };
  public onDisconnect: () => void = () => { };
  public onNotification: (message: string) => void = () => { };

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(settings: UserSettings, location: UserLocation | null, mode: AppMode) {
    this.currentSettings = settings;
    let systemInstruction = "";
    let activeTools = customTools;

    if (mode === 'translator') {
      const langA = LANGUAGE_NAMES[settings.translationLangA || 'vi'] || 'Vietnamese';
      const langB = LANGUAGE_NAMES[settings.translationLangB || 'en'] || 'English';

      systemInstruction = `
      ROLE: Professional Bi-directional Interpreter.
      LANGUAGES: ${langA} <-> ${langB}.
      
      OBJECTIVE:
      1. Listen to the input audio continuously.
      2. DETECT the language automatically.
      3. IF input is ${langA} -> Translate to ${langB}.
      4. IF input is ${langB} -> Translate to ${langA}.
      5. Call function 'report_language_change' ONLY when the language switches.
      6. OUTPUT: Translate audio ONLY. Do NOT chat. Do NOT ask questions. Keep the original tone.
      `;
      activeTools = customTools.filter(tool => tool.name !== 'play_youtube_video');
    } else {
      // Main Assistant Mode with Voice Identity Enforcement
      const userContext = settings.userVoiceSample
        ? `IMPORTANT: You have a "Main User" named ${settings.userName}. You will receive a voice sample at the start. MEMORIZE it. If a different voice speaks, you must ask: "Bạn không phải là ${settings.userName} phải không?" before obeying major commands.`
        : `User: "${settings.userName}".`;

      systemInstruction = `Role: NaNa, a witty assistant. ${userContext} CONTEXT: Location: ${location ? `${location.lat}, ${location.lng}` : "Unknown"}. SPEED: Reply INSTANTLY (under 10 words). PERSONA: Speak Vietnamese naturally. Knowledge: ${settings.fileContext.substring(0, 500)}`;
    }

    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const toolsConfig: any[] = [{ functionDeclarations: activeTools }];

      // Base configuration
      const modelConfig: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: systemInstruction,
        tools: toolsConfig,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      };

      if (settings.optimizeLatency) {
        modelConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const config: any = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: modelConfig,
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: (e: any) => {
            console.log("Session closed", e);
            this.onStateChange(EyeState.IDLE);
            this.onDisconnect();
          },
          onerror: (e: any) => {
            this.onStateChange(EyeState.IDLE);

            let msg = "Lỗi kết nối.";
            let rawMsg = "";

            if (e instanceof Error) {
              rawMsg = e.message;
            } else if (typeof e === 'string') {
              rawMsg = e;
            } else if ((e as any).message) {
              rawMsg = (e as any).message;
            } else {
              try {
                rawMsg = JSON.stringify(e);
              } catch {
                rawMsg = "Unknown Error Event";
              }
            }

            if (rawMsg.includes("Network error") || rawMsg.includes("Failed to fetch") || rawMsg.includes("network")) {
              console.warn("Gemini Live Network Error (Expected):", rawMsg);
              msg = "Lỗi mạng: Vui lòng kiểm tra kết nối Internet.";
            } else {
              console.error("Session error event:", e);
              msg = rawMsg || "Lỗi không xác định.";
            }

            if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
              msg = "Requested entity was not found (404).";
            } else if (msg.toLowerCase().includes("permission denied") || msg.includes("403") || msg.includes("401")) {
              msg = "Invalid API Key or Permission Denied.";
            }

            this.onError(msg);
            this.onDisconnect();
          }
        }
      };

      this.sessionPromise = this.ai.live.connect(config);
      const session = await this.sessionPromise;

      if (!this.sessionPromise) {
        console.log("Session connected but service was disconnected. Closing now.");
        try { session.close(); } catch (e) { }
        return;
      }
      this.session = session;

    } catch (error: any) {
      console.error("Connect failed exception:", error);
      this.onStateChange(EyeState.IDLE);

      let msg = error.message || "Không thể kết nối.";
      if (msg.includes("404")) msg = "Requested entity was not found (404).";
      if (msg.toLowerCase().includes("network error") || msg.toLowerCase().includes("failed to fetch")) {
        msg = "Lỗi mạng: Vui lòng kiểm tra kết nối Internet.";
      }

      this.onError(msg);
      this.onDisconnect();
    }
  }

  private handleOpen() {
    console.log("Connected to Gemini Live");
    this.startAudioInput();
    this.onStateChange(EyeState.LISTENING);

    // VOICE IDENTITY INJECTION
    // If user has a saved voice sample, send it immediately as context.
    if (this.currentSettings?.userVoiceSample && this.session) {
      console.log("Injecting Voice Identity Sample...");
      try {
        // Send the audio sample
        this.session.sendRealtimeInput([{
          mimeType: "audio/pcm;rate=16000",
          data: this.currentSettings.userVoiceSample
        }]);

        // Send the context instruction for that sample
        // Note: Sending text right after audio might be treated as prompt
        setTimeout(() => {
          this.session.sendRealtimeInput([{
            text: `SYSTEM NOTE: The audio chunk I just sent is the VOICE SIGNATURE of the Main User (${this.currentSettings?.userName}). Use this to distinguish the owner from others. If you hear a different voice, be skeptical.`
          }]);
        }, 500);

      } catch (e) {
        console.error("Failed to inject voice sample", e);
      }
    }
  }

  private async handleMessage(message: LiveServerMessage) {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && !this.isInterrupted) {
      this.playAudioChunk(audioData);
      this.onStateChange(EyeState.SPEAKING);
    }

    if (message.serverContent?.interrupted) {
      console.log("Server detected interruption");
      this.stopAudioPlayback();
      this.isInterrupted = true;
      this.currentOutputTranscription = "";
    }

    if (message.serverContent?.inputTranscription?.text) {
      this.currentInputTranscription += message.serverContent.inputTranscription.text;
      this.onTranscript(this.currentInputTranscription, true, false);
    }

    if (message.serverContent?.outputTranscription?.text) {
      this.currentOutputTranscription += message.serverContent.outputTranscription.text;
      this.onTranscript(this.currentOutputTranscription, false, false);
    }

    if (message.serverContent?.turnComplete) {
      this.isInterrupted = false;
      if (this.currentInputTranscription) {
        this.onTranscript(this.currentInputTranscription, true, true);
        this.currentInputTranscription = "";
      }
      if (this.currentOutputTranscription) {
        this.onTranscript(this.currentOutputTranscription, false, true);
        this.currentOutputTranscription = "";
      }
      setTimeout(() => {
        if (this.audioSources.size === 0) this.onStateChange(EyeState.LISTENING);
      }, 200);
    }

    if (message.toolCall) this.handleToolCall(message.toolCall);
  }

  private async handleToolCall(toolCall: any) {
    for (const fc of toolCall.functionCalls) {
      console.log("Tool:", fc.name, fc.args);
      let result: any = { status: "ok" };

      if (fc.name === 'play_youtube_video') {
        const rawQuery = fc.args.search_query || "";
        const query = rawQuery.replace(/['"]/g, "").trim();
        this.onVideoCommand({ isOpen: true, type: 'youtube', title: `Đang phát: ${query}`, url: query });
        result = { status: "playing", video: query };
      }
      if (fc.name === 'enter_deep_sleep') {
        this.onDeepSleepCommand();
        result = { status: "entering_sleep_mode" };
      }
      if (fc.name === 'open_settings') {
        this.onOpenSettingsCommand();
        result = { status: "settings_opened" };
      }
      if (fc.name === 'set_reminder') {
        result = { status: "reminder_set" };
      }
      if (fc.name === 'report_language_change') {
        const lang = fc.args.language || "Unknown";
        this.onNotification(`Đang dịch ngôn ngữ: ${lang}`);
        result = { status: "reported" };
      }

      if (this.sessionPromise) {
        this.sessionPromise.then(session => session.sendToolResponse({
          functionResponses: { id: fc.id, name: fc.name, response: { result } }
        }));
      }
    }
  }

  private async startAudioInput() {
    try {
      this.inputAudioContext = getAudioContext();
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // @ts-ignore
          googEchoCancellation: true,
          // @ts-ignore
          googNoiseSuppression: true,
          // @ts-ignore
          googHighpassFilter: true,
          // @ts-ignore
          googAutoGainControl: true
        }
      });

      this.source = this.inputAudioContext.createMediaStreamSource(this.stream);

      // Filters
      this.highPassFilter = this.inputAudioContext.createBiquadFilter();
      this.highPassFilter.type = "highpass";
      this.highPassFilter.frequency.value = 150;

      this.lowPassFilter = this.inputAudioContext.createBiquadFilter();
      this.lowPassFilter.type = "lowpass";
      this.lowPassFilter.frequency.value = 6000;

      this.gainNode = this.inputAudioContext.createGain();
      // Apply Sensitivity setting (Default 1.5)
      this.gainNode.gain.value = this.currentSettings?.voiceSensitivity || 1.5;

      this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

      this.source.connect(this.highPassFilter);
      this.highPassFilter.connect(this.lowPassFilter);
      this.lowPassFilter.connect(this.gainNode);
      this.gainNode.connect(this.processor);
      this.processor.connect(this.inputAudioContext.destination);

      const sourceSampleRate = this.inputAudioContext.sampleRate;

      this.processor.onaudioprocess = (e) => {
        const isAIPlaying = this.audioSources.size > 0;
        let inputData = e.inputBuffer.getChannelData(0);

        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        this.onVolumeChange(rms * 100);

        const noiseThreshold = isAIPlaying ? 0.03 : 0.015;

        if (rms < noiseThreshold) {
          for (let i = 0; i < inputData.length; i++) {
            inputData[i] = 0;
          }
        }

        if (sourceSampleRate !== 16000) {
          inputData = downsampleBuffer(inputData as any, sourceSampleRate, 16000) as any;
        }

        this.sessionPromise?.then(session => {
          try {
            const pcm16 = float32ToInt16(inputData as any);
            const base64 = arrayBufferToBase64(pcm16.buffer as any);
            session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64 } });
          } catch (err) { }
        }).catch(() => {
        });
      };
    } catch (error: any) {
      console.error("Mic error:", error);
      this.onStateChange(EyeState.IDLE);
      this.onError("Lỗi Microphone: " + (error.message || "Không thể truy cập"));
      this.onDisconnect();
    }
  }

  private async playAudioChunk(base64: string) {
    const audioCtx = getAudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (!audioCtx || this.isInterrupted) return;
    try {
      const arrayBuffer = base64ToArrayBuffer(base64);
      const float32Data = int16ToFloat32(arrayBuffer);
      const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);

      buffer.copyToChannel(float32Data as any, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      if (this.nextStartTime < currentTime) this.nextStartTime = currentTime;
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;

      this.audioSources.add(source);
      source.onended = () => {
        this.audioSources.delete(source);
        if (this.audioSources.size === 0) setTimeout(() => {
          if (this.audioSources.size === 0 && !this.isInterrupted) this.onStateChange(EyeState.LISTENING);
        }, 100);
      };
    } catch (e) { console.error("Audio play error", e); }
  }

  private stopAudioPlayback() {
    const audioCtx = getAudioContext();
    this.audioSources.forEach(s => { try { s.stop(); } catch (e) { } });
    this.audioSources.clear();
    if (audioCtx) this.nextStartTime = audioCtx.currentTime;
    this.onStateChange(EyeState.LISTENING);
  }

  public disconnect() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.processor?.disconnect();
    this.source?.disconnect();
    this.gainNode?.disconnect();
    this.lowPassFilter?.disconnect();
    this.highPassFilter?.disconnect();

    this.stopAudioPlayback();

    if (this.session) {
      try {
        this.session.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
    } else if (this.sessionPromise) {
      this.sessionPromise.then(s => {
        try {
          console.log("Closing pending session due to disconnect");
          s.close();
        } catch (e) { }
      }).catch(() => { });
    }

    this.session = null;
    this.sessionPromise = null;
  }
}