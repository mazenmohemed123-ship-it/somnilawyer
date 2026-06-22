import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { collection, query, where, orderBy, limit as limitDocs, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Announcement } from '@/types';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

export function AnnouncementBanner({ audience }: { audience: 'all' | 'lawyers' }) {
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const filters = audience === 'lawyers' ? ['all', 'lawyers'] : ['all'];
        const q = query(
          collection(db, 'announcements'),
          where('audience', 'in', filters),
          orderBy('created_at', 'desc'),
          limitDocs(1)
        );
        const snap = await withTimeout(getDocs(q), 12000, 'loadAnnouncements');
        if (!snap.empty) {
          setAnn({ id: snap.docs[0].id, ...snap.docs[0].data() } as Announcement);
        }
      } catch (e) {
        console.error('Failed to load announcements:', e);
      }
    })();
  }, [audience]);

  useEffect(() => {
    setDismissed(localStorage.getItem('somnilawyer-ann-dismissed'));
  }, []);

  if (!ann || dismissed === ann.id) return null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        background: 'linear-gradient(135deg, rgba(200,149,42,.16), rgba(212,175,55,.08))',
        borderBottom: '1px solid var(--border)', fontSize: 14,
      }}
    >
      <Megaphone size={18} color="var(--gold)" />
      <div style={{ flex: 1 }}>
        <strong>{ann.title}</strong> — <span className="muted">{ann.body}</span>
      </div>
      <button
        className="btn-icon"
        onClick={() => {
          localStorage.setItem('somnilawyer-ann-dismissed', ann.id);
          setDismissed(ann.id);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
