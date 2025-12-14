import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { UserSettings, EyeState, Emotion, VideoState, UserLocation, AppMode } from "../types";
import { getAudioContext, float32ToInt16, downsampleBuffer, arrayBufferToBase64, int16ToFloat32, base64ToArrayBuffer } from "../utils/audioUtils";

// --- 1. CẤU HÌNH TOOL CHẶT CHẼ HƠN ---
const customTools: FunctionDeclaration[] = [
  {
    name: "play_youtube_video",
    description: "Plays a YouTube video. EXECUTION RULE: Only call this tool if you have successfully found a REAL 11-character Video ID via Google Search. DO NOT GUESS. Input must be the ID (e.g. dQw4w9WgXcQ), not the title.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        videoId: { type: Type.STRING, description: "The exact 11-character YouTube Video ID (e.g. 'e-ORhEE9VVg'). Must NOT be a search term." },
        title: { type: Type.STRING, description: "The exact title of the video found in search results" }
      },
      required: ["videoId", "title"]
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
    description: "Enter deep sleep mode (Always On Display).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  },
  {
    name: "open_settings",
    description: "Open the settings menu.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  },
  {
    name: "report_language_change",
    description: "Report detected language change.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: { type: Type.STRING, description: "Detected language name" }
      },
      required: ["language"]
    }
  },
  {
    name: "search_legal_docs",
    description: "Search information in the uploaded knowledge base.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Keyword to search" }
      },
      required: ["query"]
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

  private lowPassFilter: BiquadFilterNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;

  private stream: MediaStream | null = null;
  private nextStartTime = 0;
  private audioSources = new Set<AudioBufferSourceNode>();
  private isInterrupted = false;

  private currentInputTranscription = "";
  private currentOutputTranscription = "";
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
      ROLE: Bi-directional Interpreter (${langA} <-> ${langB}).
      TASK: Translate audio instantly. No chit-chat.
      `;
      activeTools = customTools.filter(tool => tool.name === 'report_language_change');
    } else {
      const userContext = settings.userVoiceSample
        ? `IMPORTANT: User is ${settings.userName}.`
        : `User: "${settings.userName}".`;

      const kbContext = settings.fileContext
        ? `\nKNOWLEDGE BASE:\n${settings.fileContext}\nCheck this first.`
        : "";

      // --- 2. CẬP NHẬT PROMPT HỆ THỐNG MẠNH MẼ ---
      // Hướng dẫn chi tiết cách tìm kiếm và tránh Taylor Swift (hallucination phổ biến)
      systemInstruction = `
      Role: NaNa, an AI assistant. ${userContext}
      CONTEXT: Location: ${location ? `${location.lat}, ${location.lng}` : "Unknown"}.
      
      *** STRICT VIDEO SEARCH PROTOCOL ***
      1. When user asks for a video (e.g. "Pháo hoa Hồng Kông", "Thịnh Suy"), YOU MUST SEARCH GOOGLE FIRST.
      2. USE TOOL: googleSearch. Query format: "youtube video [Exact Keywords] site:youtube.com".
      3. ANALYZE RESULTS: Look for a link like "www.youtube.com/watch?v=XXXXXXXXXXX".
      4. EXTRACT ID: The "v=" parameter is the ID. It is ALWAYS 11 characters (letters, numbers, -, _).
      5. VERIFY: Does the video title match the user request? If user asked for "Fireworks", DO NOT play "Taylor Swift" music video unless explicitly asked.
      6. EXECUTE: Call 'play_youtube_video' with the extracted ID.
      7. FAILURE: If you can't find a link, say "Tôi không tìm thấy video đó". DO NOT MAKE UP AN ID.
      
      ${kbContext}
      `;
    }

    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const toolsConfig: any[] = [
        { functionDeclarations: activeTools },
        { googleSearch: {} }
      ];

      const modelConfig: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: systemInstruction,
        tools: toolsConfig,
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
            try {
              const rawMsg = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
              if (rawMsg.includes("404")) msg = "Lỗi API: Model không tồn tại (404).";
              else if (rawMsg.includes("403")) msg = "Lỗi API Key: Không có quyền (403).";
              else if (rawMsg.includes("Network")) msg = "Lỗi mạng.";
            } catch { }
            this.onError(msg);
            this.onDisconnect();
          }
        }
      };

      this.sessionPromise = this.ai.live.connect(config);
      this.session = await this.sessionPromise;

    } catch (error: any) {
      console.error("Connect failed:", error);
      this.onStateChange(EyeState.IDLE);
      this.onError(error.message || "Không thể kết nối.");
      this.onDisconnect();
    }
  }

  private handleOpen() {
    console.log("Connected to Gemini Live");
    this.startAudioInput();
    this.onStateChange(EyeState.LISTENING);
    if (this.currentSettings?.userVoiceSample && this.session) {
      try {
        this.session.sendRealtimeInput([{
          mimeType: "audio/pcm;rate=16000",
          data: this.currentSettings.userVoiceSample
        }]);
        setTimeout(() => this.session.sendRealtimeInput([{ text: "System: Voice signature sent." }]), 500);
      } catch (e) { }
    }
  }

  private async handleMessage(message: LiveServerMessage) {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && !this.isInterrupted) {
      this.playAudioChunk(audioData);
      this.onStateChange(EyeState.SPEAKING);
    }

    if (message.serverContent?.interrupted) {
      this.stopAudioPlayback();
      this.isInterrupted = true;
    }

    if (message.serverContent?.turnComplete) {
      this.isInterrupted = false;
      setTimeout(() => {
        if (this.audioSources.size === 0) this.onStateChange(EyeState.LISTENING);
      }, 200);
    }

    if (message.toolCall) this.handleToolCall(message.toolCall);
  }

  private async handleToolCall(toolCall: any) {
    for (const fc of toolCall.functionCalls) {
      console.log("Tool Call:", fc.name, fc.args);
      let result: any = { status: "ok" };

      // --- 3. LOGIC KIỂM DUYỆT (VALIDATION) NGHIÊM NGẶT ---
      if (fc.name === 'play_youtube_video') {
        let videoId = (fc.args.videoId || "").toString().trim();
        let title = (fc.args.title || "YouTube Video").toString();

        // Regex kiểm tra ID chuẩn của YouTube (11 ký tự, gồm a-z, A-Z, 0-9, -, _)
        const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;

        if (!youtubeIdRegex.test(videoId)) {
          console.error(`Invalid Video ID detected: ${videoId}`);
          // BÁO LỖI NGƯỢC LẠI CHO AI để nó tự sửa
          result = {
            status: "error",
            message: `ERROR: The ID '${videoId}' is invalid. YouTube IDs must be exactly 11 characters. You likely hallucinated this ID. Please use 'googleSearch' again to find the REAL link (e.g. youtube.com/watch?v=...) and extract the correct 'v' parameter.`
          };
        }
        else {
          // ID hợp lệ -> Gửi lệnh phát
          this.onVideoCommand({
            isOpen: true,
            type: 'youtube',
            title: `Đang phát: ${title}`,
            url: videoId
          });
          result = { status: "playing", videoId: videoId };
        }
      }
      else if (fc.name === 'enter_deep_sleep') {
        this.onDeepSleepCommand();
      }
      else if (fc.name === 'open_settings') {
        this.onOpenSettingsCommand();
      }
      else if (fc.name === 'search_legal_docs') {
        const query = (fc.args.query || "").toString().toLowerCase();
        const context = this.currentSettings?.fileContext || "";
        if (!context) {
          result = { found: false, message: "Empty Knowledge Base." };
        } else {
          const paragraphs = context.split(/\n\s*\n/);
          const matches = paragraphs.filter(p => p.toLowerCase().includes(query)).slice(0, 3).join("\n");
          result = { found: !!matches, content: matches || "Not found." };
        }
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
      this.highPassFilter = this.inputAudioContext.createBiquadFilter();
      this.highPassFilter.type = "highpass";
      this.highPassFilter.frequency.value = 150;
      this.lowPassFilter = this.inputAudioContext.createBiquadFilter();
      this.lowPassFilter.type = "lowpass";
      this.lowPassFilter.frequency.value = 6000;
      this.gainNode = this.inputAudioContext.createGain();
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
          for (let i = 0; i < inputData.length; i++) inputData[i] = 0;
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
        }).catch(() => { });
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
      try { this.session.close(); } catch (e) { }
    } else if (this.sessionPromise) {
      this.sessionPromise.then(s => { try { s.close(); } catch (e) { } }).catch(() => { });
    }
    this.session = null;
    this.sessionPromise = null;
  }
}