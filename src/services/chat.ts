import {
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs,
  collection, query, orderBy, limit as limitDocs,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { Conversation, ChatMessage, ConversationType } from '@/types';

// Deterministic conversation IDs avoid complex queries.
export function directConvId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('__');
}
export function caseConvId(caseId: string) {
  return `case__${caseId}`;
}
export function groupConvId(officeId: string) {
  return `group__${officeId}`;
}

export async function getOrCreateDirectConversation(opts: {
  me: string; other: string; caseId?: string | null; title?: string | null;
}): Promise<Conversation> {
  const { me, other, caseId = null, title = null } = opts;
  const id = caseId ? caseConvId(caseId) : directConvId(me, other);
  const convRef = doc(db, 'conversations', id);
  const existing = await getDoc(convRef);
  if (existing.exists()) {
    await updateDoc(convRef, { participants: arrayUnion(me, other) });
    return { id, ...existing.data() } as Conversation;
  }
  const data: Omit<Conversation, 'id'> = {
    type: 'direct',
    title,
    status: 'active',
    case_id: caseId,
    office_id: null,
    last_message_at: null,
    last_message_preview: null,
    created_by: me,
    created_at: new Date().toISOString(),
    participants: [me, other],
  } as any;
  await setDoc(convRef, data);
  return { id, ...data } as Conversation;
}

export async function getOrCreateOfficeGroup(opts: {
  officeId: string; me: string; members: string[]; title: string; type?: ConversationType;
}): Promise<Conversation> {
  const { officeId, me, members, title, type = 'group' } = opts;
  const id = groupConvId(officeId);
  const convRef = doc(db, 'conversations', id);
  const existing = await getDoc(convRef);
  const allMembers = Array.from(new Set([me, ...members]));
  if (existing.exists()) {
    await updateDoc(convRef, { participants: arrayUnion(...allMembers) });
    return { id, ...existing.data() } as Conversation;
  }
  const data: any = {
    type,
    title,
    status: 'active',
    case_id: null,
    office_id: officeId,
    participants: allMembers,
    last_message_at: null,
    last_message_preview: null,
    created_by: me,
    created_at: new Date().toISOString(),
  };
  await setDoc(convRef, data);
  return { id, ...data } as Conversation;
}

export async function ensureParticipants(conversationId: string, userIds: string[]) {
  const valid = userIds.filter(Boolean);
  if (!valid.length) return;
  await updateDoc(doc(db, 'conversations', conversationId), {
    participants: arrayUnion(...valid),
  });
}

export async function listMyConversations(userId: string): Promise<Conversation[]> {
  // Firestore doesn't support array-contains + orderBy on different fields without composite index.
  // We query without orderBy and sort client-side.
  const { getDocs: _get, query: _q, where } = await import('firebase/firestore');
  const q = _q(collection(db, 'conversations'), where('participants', 'array-contains', userId));
  const snap = await _get(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Conversation))
    .filter((c) => (c as any).status !== 'deleted')
    .sort((a, b) => {
      const ta = a.last_message_at ?? a.created_at ?? '';
      const tb = b.last_message_at ?? b.created_at ?? '';
      return tb.localeCompare(ta);
    });
}

// Build the client-side `attachments[]` array (used by ChatRoom) from the
// flat fields stored on an attachment message document.
export function hydrateMessage(raw: any): ChatMessage {
  const m = { ...raw } as ChatMessage;
  const url = raw.file_url ?? (raw.metadata && raw.metadata.file_url);
  if (url && (!m.attachments || m.attachments.length === 0)) {
    m.attachments = [{
      id: raw.id,
      message_id: raw.id,
      file_url: url,
      file_name: raw.file_name ?? raw.content ?? 'ملف',
      file_type: raw.file_type ?? 'other',
      mime_type: raw.mime_type ?? 'application/octet-stream',
      file_size: raw.file_size ?? 0,
      thumbnail_url: raw.thumbnail_url ?? null,
      created_at: raw.created_at,
    }];
  }
  return m;
}

export async function fetchMessages(conversationId: string, lim = 80): Promise<ChatMessage[]> {
  const q = query(
    collection(db, `conversations/${conversationId}/messages`),
    orderBy('created_at', 'asc'),
    limitDocs(lim)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => hydrateMessage({ id: d.id, ...d.data() }));
}

export async function postSystemMessage(conversationId: string, senderId: string, text: string) {
  const clientId = crypto.randomUUID();
  await addDoc(collection(db, `conversations/${conversationId}/messages`), {
    conversation_id: conversationId,
    sender_id: senderId,
    type: 'system',
    content: text,
    status: 'sent',
    client_id: clientId,
    reply_to_id: null,
    reply_to_preview: null,
    created_at: new Date().toISOString(),
    delivered_at: null,
    read_at: null,
    deleted_at: null,
    metadata: {},
  });
  await updateDoc(doc(db, 'conversations', conversationId), {
    last_message_at: new Date().toISOString(),
    last_message_preview: text.slice(0, 100),
  });
}

export async function markRead(conversationId: string, userId: string, _lastMessageId: string | null) {
  // Store last-read timestamp per user inside the conversation doc.
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`read_by.${userId}`]: new Date().toISOString(),
  });
}
