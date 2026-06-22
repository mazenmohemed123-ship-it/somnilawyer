import { useState, useRef } from 'react';
import { Mic, Square, Upload, X, Loader2 } from 'lucide-react';
import { VoiceRecorder, useSpeechRecognition, extractCaseDetails } from '@/services/voiceRecorder';
import { useToast } from './ui/Toast';

interface CaseRecorderProps {
  language?: string;
  onSave?: (data: any) => void;
}

export function CaseVoiceRecorder({ language = 'ar-SA', onSave }: CaseRecorderProps) {
  const toast = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [caseDetails, setCaseDetails] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const voiceRecorder = useRef<VoiceRecorder | null>(null);
  const speechRec = useRef<ReturnType<typeof useSpeechRecognition> | null>(null);

  const startVoiceRecording = async () => {
    try {
      setIsRecording(true);
      setTranscript('');
      voiceRecorder.current = new VoiceRecorder();
      await voiceRecorder.current.startRecording();
      toast('جارٍ التسجيل...', 'success');
    } catch (error) {
      toast('لم نتمكن من الوصول إلى المايك', 'danger');
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = async () => {
    if (!voiceRecorder.current) return;

    try {
      setIsProcessing(true);
      const recording = await voiceRecorder.current.stopRecording();

      // Use Web Speech API for transcription
      speechRec.current = useSpeechRecognition(language);
      const recognizedText = await speechRec.current.start();

      setTranscript(recognizedText);
      const details = extractCaseDetails(recognizedText);

      if (details.caseNumber) setCaseNumber(details.caseNumber);
      setCaseDetails(details.description);

      toast('تم تحويل الصوت بنجاح', 'success');
    } catch (error) {
      toast('خطأ في معالجة التسجيل', 'danger');
    } finally {
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f =>
      f.type === 'application/pdf' ||
      f.type.includes('word') ||
      f.type.includes('document')
    );

    if (validFiles.length !== files.length) {
      toast('يُقبل فقط ملفات PDF و Word', 'danger');
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!caseNumber || !caseDetails) {
      toast('الرجاء ملء رقم القضية والتفاصيل', 'danger');
      return;
    }

    const caseData = {
      caseNumber,
      details: caseDetails,
      recordedAt: new Date(),
      language,
      attachments: uploadedFiles,
    };

    onSave?.(caseData);
    toast('تم حفظ القضية', 'success');

    // Reset form
    setCaseNumber('');
    setCaseDetails('');
    setTranscript('');
    setUploadedFiles([]);
  };

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <h3 style={{ marginBottom: 16 }}>تسجيل قضية جديدة</h3>

      {/* Voice Recording Section */}
      <div style={{ marginBottom: 20 }}>
        <label className="label">تسجيل صوتي</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {!isRecording ? (
            <button
              className="btn btn-primary"
              onClick={startVoiceRecording}
              disabled={isProcessing}
              style={{ flex: 1 }}
            >
              <Mic size={18} />
              ابدأ التسجيل
            </button>
          ) : (
            <button
              className="btn"
              onClick={stopVoiceRecording}
              disabled={isProcessing}
              style={{ flex: 1, background: 'var(--danger)', color: '#fff' }}
            >
              {isProcessing ? <Loader2 size={18} className="spin" /> : <Square size={18} />}
              {isProcessing ? 'جارٍ المعالجة...' : 'إيقاف التسجيل'}
            </button>
          )}
        </div>
        {transcript && (
          <div style={{
            background: 'rgba(15,37,87,.04)',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            color: 'var(--text)',
            marginTop: 10
          }}>
            {transcript}
          </div>
        )}
      </div>

      {/* Case Details */}
      <div style={{ marginBottom: 20 }}>
        <label className="label">رقم القضية</label>
        <input
          className="input"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          placeholder="مثال: 2024-123456"
          dir="ltr"
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label className="label">تفاصيل القضية</label>
        <textarea
          className="input"
          value={caseDetails}
          onChange={(e) => setCaseDetails(e.target.value)}
          placeholder="تفاصيل القضية بالتفصيل"
          rows={6}
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* File Upload */}
      <div style={{ marginBottom: 20 }}>
        <label className="label">رفع المستندات (PDF, Word)</label>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '24px',
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          transition: 'border-color .15s ease, background .15s ease',
          background: 'rgba(15,37,87,.02)',
        }}>
          <Upload size={20} style={{ color: 'var(--navy)' }} />
          <span>اسحب الملفات أو انقر للتحديد</span>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.word"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--muted)' }}>
            الملفات المرفوعة ({uploadedFiles.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {uploadedFiles.map((file, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(15,37,87,.04)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                }}
              >
                <span>{file.name}</span>
                <button
                  className="btn-icon"
                  onClick={() => removeFile(idx)}
                  style={{ padding: 4 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        className="btn btn-primary btn-block"
        onClick={handleSave}
        disabled={isProcessing}
        style={{ marginTop: 16 }}
      >
        حفظ القضية
      </button>
    </div>
  );
}
