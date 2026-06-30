import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, limit as limitDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/services/firebase';
import { markRead, hydrateMessage } from '@/services/chat';
import { mergeMessage, pruneTyping } from './merge';
import type { ChatMessage } from '@/types';

interface TypingUser { userId: string; at: number; }

export function useChat(conversationId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const unsubRef = useRef<(() => void) | null>(null);

  const upsertMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => mergeMessage(prev, incoming));
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setLoading(true);
    setMessages([]);

    // Single source of truth: onSnapshot handles both initial load and live updates.
    // Avoids the race condition where a separate fetchMessages() call would overwrite
    // messages already delivered by the snapshot.
    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('created_at', 'asc'),
      limitDocs(500)
    );

    let initialDone = false;
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!active) return;
        if (!initialDone) {
          // First snapshot: set the full message list at once.
          initialDone = true;
          const msgs = snap.docs.map((d) => hydrateMessage({ id: d.id, ...d.data() }));
          setMessages(msgs);
          setLoading(false);
          const last = msgs[msgs.length - 1];
          if (userId && last) markRead(conversationId, userId, last.id);
        } else {
          // Subsequent changes: merge incrementally (preserves optimistic messages).
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const msg = hydrateMessage({ id: change.doc.id, ...change.doc.data() });
              upsertMessage(msg);
              if (change.type === 'added' && userId && msg.sender_id !== userId) {
                markRead(conversationId, userId, msg.id);
              }
            }
          });
        }
      },
      (err) => {
        if (!active) return;
        console.error('Chat snapshot error:', err);
        setLoading(false);
      }
    );

    unsubRef.current = unsub;
    return () => {
      active = false;
      unsub();
    };
  }, [conversationId, userId, upsertMessage]);

  useEffect(() => {
    if (!typing.length) return;
    const t = setInterval(() => {
      setTyping((prev) => pruneTyping(prev));
    }, 1000);
    return () => clearInterval(t);
  }, [typing.length]);

  const broadcastTyping = useCallback(() => {
    // Typing indicator via presence document (simplified)
  }, []);

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
      };
      upsertMessage(optimistic);

      try {
        const docRef = await addDoc(collection(db, `conversations/${conversationId}/messages`), {
          conversation_id: conversationId,
          sender_id: userId,
          type: optimistic.type,
          content: optimistic.content,
          status: 'sent',
          client_id: clientId,
          reply_to_id: optimistic.reply_to_id,
          reply_to_preview: optimistic.reply_to_preview,
          created_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          deleted_at: null,
          metadata: {},
        });
        upsertMessage({ ...optimistic, id: docRef.id });
        await updateDoc(doc(db, 'conversations', conversationId), {
          last_message_at: new Date().toISOString(),
          last_message_preview: content.slice(0, 100),
        });
      } catch (e: any) {
        setMessages((prev) =>
          prev.map((m) => (m.client_id === clientId ? { ...m, status: 'failed' } : m))
        );
      }
    },
    [conversationId, userId, upsertMessage]
  );

  const sendAttachment = useCallback(
    async (file: File, fileType: string) => {
      if (!conversationId || !userId) return;
      const clientId = crypto.randomUUID();
      try {
        const path = `chat-attachments/${conversationId}/${clientId}-${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const fileUrl = await getDownloadURL(storageRef);

        const docRef = await addDoc(collection(db, `conversations/${conversationId}/messages`), {
          conversation_id: conversationId,
          sender_id: userId,
          type: 'attachment',
          content: file.name,
          status: 'sent',
          client_id: clientId,
          file_url: fileUrl,
          file_name: file.name,
          file_type: fileType,
          mime_type: file.type || 'application/octet-stream',
          file_size: file.size,
          created_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          deleted_at: null,
          metadata: {},
        });

        upsertMessage({
          id: docRef.id,
          conversation_id: conversationId,
          sender_id: userId,
          type: 'attachment',
          content: file.name,
          status: 'sent',
          client_id: clientId,
          reply_to_id: null,
          reply_to_preview: null,
          created_at: new Date().toISOString(),
          delivered_at: null,
          read_at: null,
          deleted_at: null,
          metadata: { file_url: fileUrl, file_type: fileType, mime_type: file.type, file_size: file.size },
          attachments: [{
            id: docRef.id,
            message_id: docRef.id,
            file_url: fileUrl,
            file_name: file.name,
            file_type: fileType as any,
            mime_type: file.type || 'application/octet-stream',
            file_size: file.size,
            thumbnail_url: null,
            created_at: new Date().toISOString(),
          }],
        } as ChatMessage);

        await updateDoc(doc(db, 'conversations', conversationId), {
          last_message_at: new Date().toISOString(),
          last_message_preview: `📎 ${file.name}`,
        });
      } catch (e) {
        throw e;
      }
    },
    [conversationId, userId, upsertMessage]
  );

  const softDelete = useCallback(async (messageId: string) => {
    await updateDoc(doc(db, `conversations/${conversationId}/messages/${messageId}`), {
      deleted_at: new Date().toISOString(),
      content: '',
    });
  }, [conversationId]);

  return { messages, loading, typing, online, sendText, sendAttachment, softDelete, broadcastTyping };
}
