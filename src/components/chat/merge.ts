import type { ChatMessage } from '@/types';

// Pure message-list merge with client_id dedupe. Extracted so it can be unit-tested
// independently of React. This is the core guarantee: no duplicate messages even
// when an optimistic insert and its realtime echo both arrive.
export function mergeMessage(prev: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  // 1) Replace an optimistic/previous row that shares the same client_id.
  const byClient = prev.findIndex((m) => m.client_id === incoming.client_id);
  if (byClient >= 0) {
    const next = [...prev];
    next[byClient] = { ...incoming, attachments: incoming.attachments ?? next[byClient].attachments };
    return next;
  }
  // 2) Already present by server id -> shallow-merge updates (status/read_at/etc).
  if (prev.some((m) => m.id === incoming.id)) {
    return prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m));
  }
  // 3) New message -> append, keep chronological order.
  return [...prev, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// Drop typing entries older than the auto-clear window (default 3s).
export function pruneTyping<T extends { at: number }>(list: T[], now = Date.now(), windowMs = 3000): T[] {
  return list.filter((u) => now - u.at < windowMs);
}
