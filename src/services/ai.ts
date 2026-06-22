import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

export type AiTask = 'chat' | 'summarize' | 'asr' | 'ocr';

interface AiResponse {
  result: string;
  error?: string;
  remaining?: number;
}

export async function callAi(task: AiTask, payload: Record<string, unknown>): Promise<AiResponse> {
  try {
    const fn = httpsCallable<Record<string, unknown>, AiResponse>(functions, 'aiTools');
    const res = await fn({ task, ...payload });
    return res.data;
  } catch (e: any) {
    return { result: '', error: e.message ?? 'تعذّر الاتصال بالذكاء الاصطناعي' };
  }
}

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
