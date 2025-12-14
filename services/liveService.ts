import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { UserSettings, EyeState, Emotion, VideoState, UserLocation, AppMode } from "../types";
import { getAudioContext, float32ToInt16, downsampleBuffer, arrayBufferToBase64, int16ToFloat32, base64ToArrayBuffer } from "../utils/audioUtils";

const customTools: FunctionDeclaration[] = [
  {
    name: "play_youtube_video",
    description: "Play a specific YouTube video. REQUIREMENT: You MUST have a valid 11-character Video ID found via Google Search. If you only have a title, use 'googleSearch' tool first to find the ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        videoId: { type: Type.STRING, description: "The 11-character YouTube Video ID (e.g. dQw4w9WgXcQ)" },
        title: { type: Type.STRING, description: "The title of the video" }
      },
      required: ["videoId", "title"]
    }
  },
  // ... (Giữ nguyên các tool khác: set_reminder, enter_deep_sleep, open_settings, report_language_change, search_legal_docs)
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
    description: "Open the settings menu when the user asks to open settings.",
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
        language: { type: Type.STRING, description: "The detected language name" }
      },
      required: ["language"]
    }
  },
  {
    name: "search_legal_docs",
    description: "Search for specific information in the provided knowledge base/documents.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "The keyword to search for" }
      },
      required: ["query"]
    }
  }
];

// ... (Giữ nguyên LANGUAGE_NAMES)
const LANGUAGE_NAMES: { [key: string]: string } = {
  'vi': 'Vietnamese', 'en': 'English', 'ja': 'Japanese', 'ko': 'Korean',
  'zh': 'Chinese (Mandarin)', 'hi': 'Hindi (Indian)', 'ru': 'Russian',
  'fr': 'French', 'de': 'German', 'es': 'Spanish', 'it': 'Italian',
  'pt': 'Portuguese', 'th': 'Thai', 'id': 'Indonesian', 'ar': 'Arabic'
};

export class LiveService {
  // ... (Giữ nguyên các biến private)
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
      // ... (Giữ nguyên logic translator)
      const langA = LANGUAGE_NAMES[settings.translationLangA || 'vi'] || 'Vietnamese';
      const langB = LANGUAGE_NAMES[settings.translationLangB || 'en'] || 'English';
      systemInstruction = `ROLE: Professional Bi-directional Interpreter. LANGUAGES: ${langA} <-> ${langB}. OBJECTIVE: Listen, DETECT language, and TRANSLATE immediately. Call 'report_language_change' only when language switches. OUTPUT: Translate audio ONLY. No chit-chat.`;
      activeTools = customTools.filter(tool => tool.name === 'report_language_change');
    } else {
      const userContext = settings.userVoiceSample ? `IMPORTANT: Main User is ${settings.userName}.` : `User: "${settings.userName}".`;
      const kbContext = settings.fileContext ? `\n\nKNOWLEDGE BASE:\n${settings.fileContext}` : "";

      // --- CẬP NHẬT SYSTEM INSTRUCTION (QUAN TRỌNG) ---
      // Bắt buộc quy trình: Search -> Extract ID -> Play
      systemInstruction = `
      Role: NaNa, a helpful assistant. ${userContext}
      CONTEXT: Location: ${location ? `${location.lat}, ${location.lng}` : "Unknown"}.
      
      *** VIDEO PLAYBACK PROTOCOL ***
      1. When user asks to play music/video (e.g. "Mở bài Một đêm say"), DO NOT guess the ID.
      2. FIRST, call tool 'googleSearch' with query: "youtube video id for [Song Name] [Artist]".
      3. FROM SEARCH RESULTS, extract the Video ID (11 chars after 'v=').
      4. THEN, call 'play_youtube_video' with that extracted ID.
      5. NEVER use a fake ID or Taylor Swift's ID unless requested.
      
      ${kbContext}
      `;
    }

    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      // Kết hợp custom tools và googleSearch
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

      if (settings.optimizeLatency) modelConfig.thinkingConfig = { thinkingBudget: 0 };

      const config: any = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: modelConfig,
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: (e: any) => { this.onStateChange(EyeState.IDLE); this.onDisconnect(); },
          onerror: (e: any) => { this.onStateChange(EyeState.IDLE); this.onError("Lỗi kết nối."); this.onDisconnect(); }
        }
      };

      this.sessionPromise = this.ai.live.connect(config);
      this.session = await this.sessionPromise;

    } catch (error: any) {
      this.onStateChange(EyeState.IDLE);
      this.onError(error.message || "Không thể kết nối.");
      this.onDisconnect();
    }
  }

  // ... (Giữ nguyên handleOpen)
  private handleOpen() {
    console.log("Connected to Gemini Live");
    this.startAudioInput();
    this.onStateChange(EyeState.LISTENING);
    if (this.currentSettings?.userVoiceSample && this.session) {
      try {
        this.session.sendRealtimeInput([{ mimeType: "audio/pcm;rate=16000", data: this.currentSettings.userVoiceSample }]);
        setTimeout(() => this.session.sendRealtimeInput([{ text: "System: Voice signature sent." }]), 500);
      } catch (e) { }
    }
  }

  // ... (Giữ nguyên handleMessage - Logic chat history đã fix ở bước trước)
  private async handleMessage(message: LiveServerMessage) {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && !this.isInterrupted) {
      this.playAudioChunk(audioData);
      this.onStateChange(EyeState.SPEAKING);
    }
    if (message.serverContent?.interrupted) {
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
      if (this.currentInputTranscription.trim()) {
        this.onTranscript(this.currentInputTranscription, true, true);
        this.currentInputTranscription = "";
      }
      if (this.currentOutputTranscription.trim()) {
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
      console.log("Tool Call:", fc.name, fc.args);
      let result: any = { status: "ok" };

      if (fc.name === 'play_youtube_video') {
        const videoId = (fc.args.videoId || "").toString().trim();
        const title = (fc.args.title || "YouTube Video").toString();

        // Kiểm tra xem AI có gửi ID hay Search Query
        // Nếu là ID (11 ký tự): Gửi ID để Auto Play
        if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          this.onVideoCommand({
            isOpen: true,
            type: 'youtube',
            title: `Đang phát: ${title}`,
            url: videoId
          });
          result = { status: "playing", videoId: videoId };
        } else {
          // Nếu AI vẫn gửi tào lao (từ khóa vào ô ID), ta fallback về search query
          // VideoPlayer sẽ hiện Card Search thay vì Iframe lỗi
          this.onVideoCommand({
            isOpen: true,
            type: 'youtube',
            title: `Tìm kiếm: ${title}`,
            url: title // Fallback dùng title làm query
          });
          result = { status: "fallback_search", query: title };
        }
      }
      // ... (Các tool khác giữ nguyên logic cũ)
      else if (fc.name === 'enter_deep_sleep') { this.onDeepSleepCommand(); }
      else if (fc.name === 'open_settings') { this.onOpenSettingsCommand(); }
      else if (fc.name === 'set_reminder') { result = { status: "reminder_set" }; }
      else if (fc.name === 'report_language_change') {
        const lang = fc.args.language || "Unknown";
        this.onNotification(`Đang dịch ngôn ngữ: ${lang}`);
      }
      else if (fc.name === 'search_legal_docs') {
        const query = (fc.args.query || "").toString().toLowerCase();
        const context = this.currentSettings?.fileContext || "";
        if (!context) {
          result = { found: false, message: "Documents empty." };
        } else {
          const paragraphs = context.split(/\n\s*\n/);
          const matches = paragraphs.filter(p => p.toLowerCase().includes(query)).slice(0, 3).join("\n---\n");
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

  // ... (Giữ nguyên các hàm startAudioInput, playAudioChunk, disconnect...)
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