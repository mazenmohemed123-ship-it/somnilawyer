import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { supabase } from '@/services/supabase';
import type { Announcement } from '@/types';

export function AnnouncementBanner({ audience }: { audience: 'all' | 'lawyers' }) {
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const filter = audience === 'lawyers' ? ['all', 'lawyers'] : ['all'];
    supabase
      .from('announcements')
      .select('*')
      .in('audience', filter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAnn(data as Announcement));
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
