import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div
      style={{
        position: 'fixed', bottom: 16, insetInlineStart: 16, zIndex: 1500,
        background: 'var(--navy)', color: '#fff', padding: '12px 14px', borderRadius: 14,
        boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 360,
      }}
    >
      <Download size={20} />
      <div style={{ flex: 1, fontSize: 14 }}>ثبّت Somni Lawyer كتطبيق على جهازك</div>
      <button
        className="btn btn-gold btn-sm"
        onClick={async () => {
          deferred.prompt();
          await deferred.userChoice;
          setVisible(false);
          setDeferred(null);
        }}
      >
        تثبيت
      </button>
      <button className="btn-icon" style={{ color: '#fff', borderColor: 'transparent' }} onClick={() => setVisible(false)}>
        <X size={16} />
      </button>
    </div>
  );
}
