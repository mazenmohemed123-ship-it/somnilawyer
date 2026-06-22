import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import { fetchMessages, markRead } from '@/services/chat';
import type { ChatMessage } from '@/types';

interface TypingUser { userId: string; at: number; }

export function useChat(conversationId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seenClientIds = useRef<Set<string>>(new Set());

  // Merge helper with client_id dedupe (prevents optimistic duplicates).
  const upsertMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      // Replace optimistic message with same client_id.
      const byClient = prev.findIndex((m) => m.client_id === incoming.client_id);
      if (byClient >= 0) {
        const next = [...prev];
        next[byClient] = { ...incoming, attachments: incoming.attachments ?? next[byClient].attachments };
        return next;
      }
      // Skip if already present by id.
      if (prev.some((m) => m.id === incoming.id)) {
        return prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m));
      }
      return [...prev, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  // Initial load + realtime subscription.
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setLoading(true);
    seenClientIds.current = new Set();

    fetchMessages(conversationId).then((rows) => {
      if (!active) return;
      rows.forEach((r) => seenClientIds.current.add(r.client_id));
      setMessages(rows);
      setLoading(false);
      const last = rows[rows.length - 1];
      if (userId) markRead(conversationId, userId, last?.id ?? null);
    });

    const channel = supabase
      .channel(`conv:${conversationId}`, { config: { presence: { key: userId ?? 'anon' } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const row = payload.new as ChatMessage;
          // Hydrate attachments for attachment messages.
          if (row.type === 'attachment') {
            const { data: atts } = await supabase.from('attachments').select('*').eq('message_id', row.id);
            row.attachments = (atts ?? []) as any;
          }
          upsertMessage(row);
          if (userId && row.sender_id !== userId) markRead(conversationId, userId, row.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => upsertMessage(payload.new as ChatMessage)
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const uid = (payload.payload as any)?.userId as string;
        if (!uid || uid === userId) return;
        setTyping((prev) => {
          const others = prev.filter((t) => t.userId !== uid);
          return [...others, { userId: uid, at: Date.now() }];
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userId) {
          await channel.track({ userId, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
    return () => {
      active = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId, upsertMessage]);

  // Auto-clear typing indicators after 3s.
  useEffect(() => {
    if (!typing.length) return;
    const t = setInterval(() => {
      setTyping((prev) => prev.filter((u) => Date.now() - u.at < 3000));
    }, 1000);
    return () => clearInterval(t);
  }, [typing.length]);

  const broadcastTyping = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId } });
  }, [userId]);

  const sendText = useCallback(
    async (content: string, replyTo?: ChatMessage | null) => {
      if (!conversationId || !userId || !content.trim()) return;
      const clientId = crypto.randomUUID();
      const optimistic: ChatMessage = {
        id: `opt-${clientId}`,
        conversation_id: conversationId,
        sender_id: userId,
        type: replyTo ? 'reply' : 'text',
        content: content.trim(),
        status: 'pending',
        client_id: clientId,
        reply_to_id: replyTo?.id ?? null,
        reply_to_preview: replyTo ? replyTo.content.slice(0, 80) : null,
        created_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
        deleted_at: null,
        metadata: {},
        _optimistic: true,
      };
      upsertMessage(optimistic);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          type: optimistic.type,
          content: optimistic.content,
          status: 'sent',
          client_id: clientId,
          reply_to_id: optimistic.reply_to_id,
          reply_to_preview: optimistic.reply_to_preview,
        })
        .select('*')
        .single();

      if (error) {
        // On unique-violation (already inserted via race) ignore; else mark failed.
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: error.code === '23505' ? 'sent' : 'failed' } : m))
        );
        return;
      }
      upsertMessage(data as ChatMessage);
    },
    [conversationId, userId, upsertMessage]
  );

  const sendAttachment = useCallback(
    async (file: File, fileType: string) => {
      if (!conversationId || !userId) return;
      const clientId = crypto.randomUUID();
      const path = `${conversationId}/${clientId}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('chat-attachments').getPublicUrl(path);

      const { data: msg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          type: 'attachment',
          content: file.name,
          status: 'sent',
          client_id: clientId,
        })
        .select('*')
        .single();
      if (error) throw error;

      await supabase.from('attachments').insert({
        message_id: msg.id,
        file_url: pub.publicUrl,
        file_name: file.name,
        file_type: fileType,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
      });
      const { data: atts } = await supabase.from('attachments').select('*').eq('message_id', msg.id);
      upsertMessage({ ...(msg as ChatMessage), attachments: (atts ?? []) as any });
    },
    [conversationId, userId, upsertMessage]
  );

  const softDelete = useCallback(async (messageId: string) => {
    await supabase.from('messages').update({ deleted_at: new Date().toISOString(), content: '' }).eq('id', messageId);
  }, []);

  return { messages, loading, typing, online, sendText, sendAttachment, softDelete, broadcastTyping };
}
