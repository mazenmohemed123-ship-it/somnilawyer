import { describe, it, expect } from 'vitest';
import { mergeMessage, pruneTyping } from './merge';
import type { ChatMessage } from '@/types';

function msg(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: over.id ?? 'srv-1',
    conversation_id: 'c1',
    sender_id: 'u1',
    type: 'text',
    content: 'hi',
    status: 'sent',
    client_id: over.client_id ?? 'cid-1',
    reply_to_id: null,
    reply_to_preview: null,
    created_at: over.created_at ?? '2026-01-01T00:00:00.000Z',
    delivered_at: null,
    read_at: null,
    deleted_at: null,
    metadata: {},
    ...over,
  };
}

describe('mergeMessage — chat dedupe & ordering', () => {
  it('appends a brand new message', () => {
    const out = mergeMessage([], msg({ id: 'a', client_id: 'ca' }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  it('replaces the optimistic message with the server echo (no duplicate)', () => {
    const optimistic = msg({ id: 'opt-cid-1', client_id: 'cid-1', status: 'pending', _optimistic: true });
    const serverEcho = msg({ id: 'srv-123', client_id: 'cid-1', status: 'sent' });
    let list = mergeMessage([], optimistic);
    list = mergeMessage(list, serverEcho);
    expect(list).toHaveLength(1); // dedupe by client_id
    expect(list[0].id).toBe('srv-123');
    expect(list[0].status).toBe('sent');
    expect(list[0]._optimistic).toBeUndefined();
  });

  it('does not duplicate when the same server row arrives twice (realtime echo)', () => {
    const row = msg({ id: 'srv-9', client_id: 'cid-9' });
    let list = mergeMessage([], row);
    list = mergeMessage(list, { ...row, read_at: '2026-01-01T01:00:00.000Z' });
    expect(list).toHaveLength(1);
    expect(list[0].read_at).toBe('2026-01-01T01:00:00.000Z'); // update merged in
  });

  it('keeps messages in chronological order', () => {
    let list = mergeMessage([], msg({ id: 'b', client_id: 'cb', created_at: '2026-01-01T00:00:02.000Z' }));
    list = mergeMessage(list, msg({ id: 'a', client_id: 'ca', created_at: '2026-01-01T00:00:01.000Z' }));
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('preserves attachments when an update lacks them', () => {
    const withAtt = msg({ id: 's', client_id: 'cs', attachments: [{ id: 'att1' } as any] });
    let list = mergeMessage([], withAtt);
    list = mergeMessage(list, msg({ id: 's2', client_id: 'cs' })); // same client_id, no attachments
    expect(list).toHaveLength(1);
    expect(list[0].attachments).toHaveLength(1);
  });
});

describe('pruneTyping — auto-clear after 3s', () => {
  it('removes stale typing entries and keeps recent ones', () => {
    const now = 10_000;
    const out = pruneTyping([{ at: now - 5000 }, { at: now - 1000 }], now);
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe(now - 1000);
  });
});
