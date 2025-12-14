import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { UserSettings, EyeState, Emotion, VideoState, UserLocation, AppMode } from "../types";
import { getAudioContext, float32ToInt16, downsampleBuffer, arrayBufferToBase64, int16ToFloat32, base64ToArrayBuffer } from "../utils/audioUtils";

const customTools: FunctionDeclaration[] = [
  {
    name: "play_youtube_video",
    description: "Search and play a video on YouTube. Use this when the user asks to play music or watch a video.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        search_query: { type: Type.STRING, description: "The exact keywords or title of the video the user wants to watch (e.g. 'Son Tung MTP', 'Fireworks in Hong Kong'). Do NOT try to guess the Video ID." }
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

  // Transcription buffer
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
      ROLE: Professional Bi-directional Interpreter.
      LANGUAGES: ${langA} <-> ${langB}.
      OBJECTIVE: Listen, DETECT language, and TRANSLATE immediately.
      Call 'report_language_change' only when language switches.
      OUTPUT: Translate audio ONLY. No chit-chat.
      `;
      activeTools = customTools.filter(tool => tool.name === 'report_language_change');
    } else {
      const userContext = settings.userVoiceSample
        ? `IMPORTANT: Main User is ${settings.userName}. Verify voice identity if needed.`
        : `User: "${settings.userName}".`;

      const kbContext = settings.fileContext
        ? `\n\nKNOWLEDGE BASE (Priority Reference):\n${settings.fileContext}\n\nINSTRUCTION: Check Knowledge Base first for answers.`
        : "";

      // --- SYSTEM INSTRUCTION (Đã đơn giản hóa để tránh ảo giác) ---
      systemInstruction = `
      Role: NaNa, a witty assistant. ${userContext}
      CONTEXT: Location: ${location ? `${location.lat}, ${location.lng}` : "Unknown"}.
      PERSONA: Speak Vietnamese naturally.
      
      VIDEO INSTRUCTION:
      When asked to play a video, simply call 'play_youtube_video' with the user's EXACT keywords (e.g. "Pháo hoa Hồng Kông"). 
      DO NOT try to guess the ID. DO NOT make up fake IDs.
      
      ${kbContext}
      `;
    }

    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      // Chỉ sử dụng customTools, không dùng googleSearch native để tránh conflict logic
      const toolsConfig: any[] = [
        { functionDeclarations: activeTools },
        { googleSearch: {} } // Vẫn giữ để tra cứu thông tin, nhưng không dùng cho video ID nữa
      ];

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
            let rawMsg = typeof e === 'string' ? e : (e.message || JSON.stringify(e));

            if (rawMsg.includes("Network") || rawMsg.includes("fetch")) {
              msg = "Lỗi mạng: Kiểm tra kết nối Internet.";
            } else if (rawMsg.includes("404") || rawMsg.includes("not found")) {
              msg = "Lỗi API: Model không tìm thấy hoặc Project bị xóa.";
            } else if (rawMsg.includes("403") || rawMsg.includes("Permission")) {
              msg = "Lỗi API Key: Không có quyền truy cập.";
            }

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
        setTimeout(() => {
          this.session.sendRealtimeInput([{
            text: `SYSTEM NOTE: User Voice Signature provided.`
          }]);
        }, 500);
      } catch (e) { }
    }
  }

  // --- PHỤC HỒI LOGIC CHAT HISTORY ---
  private async handleMessage(message: LiveServerMessage) {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && !this.isInterrupted) {
      this.playAudioChunk(audioData);
      this.onStateChange(EyeState.SPEAKING);
    }

    if (message.serverContent?.interrupted) {
      this.stopAudioPlayback();
      this.isInterrupted = true;
      this.currentOutputTranscription = ""; // Clear buffer on interrupt
    }

    // 1. Xử lý Input (Lời người nói)
    if (message.serverContent?.inputTranscription?.text) {
      this.currentInputTranscription += message.serverContent.inputTranscription.text;
      this.onTranscript(this.currentInputTranscription, true, false); // isFinal = false
    }

    // 2. Xử lý Output (Lời AI nói)
    if (message.serverContent?.outputTranscription?.text) {
      this.currentOutputTranscription += message.serverContent.outputTranscription.text;
      this.onTranscript(this.currentOutputTranscription, false, false); // isFinal = false
    }

    // 3. Khi lượt nói hoàn tất (Turn Complete) -> Chốt đoạn chat
    if (message.serverContent?.turnComplete) {
      this.isInterrupted = false;

      // Chốt câu của User
      if (this.currentInputTranscription.trim()) {
        this.onTranscript(this.currentInputTranscription, true, true); // isFinal = true
        this.currentInputTranscription = "";
      }

      // Chốt câu của AI
      if (this.currentOutputTranscription.trim()) {
        this.onTranscript(this.currentOutputTranscription, false, true); // isFinal = true
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

      // --- LOGIC VIDEO AN TOÀN ---
      if (fc.name === 'play_youtube_video') {
        const query = (fc.args.search_query || "").toString().trim();

        // Luôn gửi lệnh mở video với query
        // VideoPlayer.tsx sẽ lo việc hiển thị thẻ Preview nếu là query
        this.onVideoCommand({
          isOpen: true,
          type: 'youtube',
          title: `Tìm kiếm: ${query}`,
          url: query
        });
        result = { status: "playing", query: query };
      }
      else if (fc.name === 'enter_deep_sleep') {
        this.onDeepSleepCommand();
        result = { status: "entering_sleep_mode" };
      }
      else if (fc.name === 'open_settings') {
        this.onOpenSettingsCommand();
        result = { status: "settings_opened" };
      }
      else if (fc.name === 'set_reminder') {
        result = { status: "reminder_set" };
      }
      else if (fc.name === 'report_language_change') {
        const lang = fc.args.language || "Unknown";
        this.onNotification(`Đang dịch ngôn ngữ: ${lang}`);
        result = { status: "reported" };
      }
      else if (fc.name === 'search_legal_docs') {
        const query = (fc.args.query || "").toString().toLowerCase();
        const context = this.currentSettings?.fileContext || "";

        if (!context) {
          result = { found: false, message: "Documents empty." };
        } else {
          // Logic tìm kiếm đơn giản
          const paragraphs = context.split(/\n\s*\n/);
          const matches = paragraphs
            .filter(p => p.toLowerCase().includes(query))
            .slice(0, 3)
            .join("\n---\n");

          if (matches) {
            result = { found: true, content: matches };
          } else {
            result = { found: false, message: "Not found in documents." };
          }
        }
      }

      if (this.sessionPromise) {
        this.sessionPromise.then(session => session.sendToolResponse({
          functionResponses: { id: fc.id, name: fc.name, response: { result } }
        }));
      }
    }
  }

  // --- CÁC HÀM XỬ LÝ AUDIO (Giữ nguyên) ---
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