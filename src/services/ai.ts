import { supabase } from './supabase';

export type AiTask = 'chat' | 'summarize' | 'asr' | 'ocr';

interface AiResponse {
  result: string;
  error?: string;
  remaining?: number;
}

// Calls the `ai-tools` edge function. The HF token stays server-side.
export async function callAi(task: AiTask, payload: Record<string, unknown>): Promise<AiResponse> {
  const { data, error } = await supabase.functions.invoke('ai-tools', {
    body: { task, ...payload },
  });
  if (error) return { result: '', error: error.message };
  return data as AiResponse;
}

// Transcribe an audio file via Whisper (base64).
export async function transcribeAudio(file: File): Promise<AiResponse> {
  const base64 = await fileToBase64(file);
  return callAi('asr', { audio: base64, mime: file.type });
}

export async function ocrImage(file: File): Promise<AiResponse> {
  const base64 = await fileToBase64(file);
  return callAi('ocr', { image: base64, mime: file.type });
}

export async function summarizeText(text: string): Promise<AiResponse> {
  return callAi('summarize', { text });
}

export async function legalAssistant(messages: { role: string; content: string }[]): Promise<AiResponse> {
  return callAi('chat', { messages });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.split(',')[1] ?? r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
