// Voice recording and transcription service for case documentation

export interface VoiceRecording {
  blob: Blob;
  duration: number;
  timestamp: Date;
  url: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;

  async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];
    this.startTime = Date.now();

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<VoiceRecording> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) throw new Error('No recording in progress');

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const duration = (Date.now() - this.startTime) / 1000;
        const url = URL.createObjectURL(blob);

        resolve({
          blob,
          duration,
          timestamp: new Date(),
          url,
        });

        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    this.chunks = [];
  }
}

// Simple speech-to-text using Web Speech API
export function useSpeechRecognition(language: string = 'ar-SA') {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) throw new Error('Speech Recognition not supported');

  const recognition = new SR();
  recognition.language = language;
  recognition.continuous = true;
  recognition.interimResults = true;

  const state = {
    isListening: false,
    transcript: '',
    isFinal: false,
  };

  const start = (): Promise<string> => {
    return new Promise((resolve) => {
      let finalTranscript = '';

      recognition.onstart = () => {
        state.isListening = true;
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            state.isFinal = true;
          } else {
            interimTranscript += transcript;
          }
        }
        state.transcript = finalTranscript + interimTranscript;
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };

      recognition.onend = () => {
        state.isListening = false;
        resolve(finalTranscript.trim());
      };

      recognition.start();
    });
  };

  const stop = () => {
    recognition.stop();
  };

  return { start, stop, state };
}

// Mock transcription service (in production, integrate with a real API like Google Cloud Speech-to-Text or AssemblyAI)
export async function transcribeAudio(blob: Blob, language: string = 'ar'): Promise<TranscriptionResult> {
  // For now, return a mock result
  // In production: send to speech-to-text API
  return {
    text: 'قضية رقم 123 - نزاع بين طرفين بشأن دين',
    confidence: 0.95,
    language,
  };
}

// Extract case details from transcribed text
export function extractCaseDetails(text: string): {
  caseNumber?: string;
  clientName?: string;
  description: string;
} {
  const caseNumberMatch = text.match(/قضية\s+رقم\s+(\d+)|case\s+#?(\d+)|dossier\s+n[°o]?\s*(\d+)/i);
  const clientMatch = text.match(/موكل|client|demandeur|davacı/i);

  return {
    caseNumber: caseNumberMatch ? caseNumberMatch[1] || caseNumberMatch[2] || caseNumberMatch[3] : undefined,
    clientName: clientMatch ? text.substring(0, 30) : undefined,
    description: text,
  };
}
