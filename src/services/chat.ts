import { supabase } from './supabase';
import type { Conversation, ChatMessage, ConversationType } from '@/types';

// Resolve (find-or-create) a direct conversation between two users, optionally bound to a case.
export async function getOrCreateDirectConversation(opts: {
  me: string;
  other: string;
  caseId?: string | null;
  title?: string | null;
}): Promise<Conversation> {
  const { me, other, caseId = null, title = null } = opts;

  // If bound to a case, prefer the conversation for that case.
  if (caseId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('case_id', caseId)
      .eq('type', 'direct')
      .limit(1)
      .maybeSingle();
    if (existing) {
      await ensureParticipants(existing.id, [me, other]);
      return existing as Conversation;
    }
  } else {
    // Find a direct conversation where both are participants.
    const { data: mine } = await supabase
      .from('participants')
      .select('conversation_id')
      .eq('user_id', me);
    const ids = (mine ?? []).map((r) => r.conversation_id);
    if (ids.length) {
      const { data: shared } = await supabase
        .from('participants')
        .select('conversation_id')
        .eq('user_id', other)
        .in('conversation_id', ids);
      const candidate = (shared ?? [])[0]?.conversation_id;
      if (candidate) {
        const { data: conv } = await supabase.from('conversations').select('*').eq('id', candidate).eq('type', 'direct').maybeSingle();
        if (conv) return conv as Conversation;
      }
    }
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ type: 'direct', title, case_id: caseId, created_by: me })
    .select('*')
    .single();
  if (error) throw error;
  await ensureParticipants(created.id, [me, other]);
  return created as Conversation;
}

// Find-or-create a group conversation for an office (team chat).
export async function getOrCreateOfficeGroup(opts: {
  officeId: string;
  me: string;
  members: string[];
  title: string;
  type?: ConversationType;
}): Promise<Conversation> {
  const { officeId, me, members, title, type = 'group' } = opts;
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('office_id', officeId)
    .eq('type', type)
    .limit(1)
    .maybeSingle();
  let conv = existing as Conversation | null;
  if (!conv) {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ type, title, office_id: officeId, created_by: me })
      .select('*')
      .single();
    if (error) throw error;
    conv = created as Conversation;
  }
  await ensureParticipants(conv.id, Array.from(new Set([me, ...members])));
  return conv;
}

export async function ensureParticipants(conversationId: string, userIds: string[]) {
  const rows = userIds.filter(Boolean).map((uid) => ({ conversation_id: conversationId, user_id: uid }));
  if (!rows.length) return;
  // upsert ignores duplicates via the unique index
  await supabase.from('participants').upsert(rows, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true });
}

export async function listMyConversations(): Promise<Conversation[]> {
  const { data: parts } = await supabase.from('participants').select('conversation_id');
  const ids = (parts ?? []).map((p) => p.conversation_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .in('id', ids)
    .neq('status', 'deleted')
    .order('last_message_at', { ascending: false, nullsFirst: false });
  return (data ?? []) as Conversation[];
}

export async function postSystemMessage(conversationId: string, senderId: string, text: string) {
  const clientId = crypto.randomUUID();
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    type: 'system',
    content: text,
    status: 'sent',
    client_id: clientId,
  });
}

export async function markRead(conversationId: string, userId: string, lastMessageId: string | null) {
  // Read receipts go through a SECURITY DEFINER RPC (RLS restricts message UPDATE to the sender).
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  if (lastMessageId) {
    await supabase
      .from('participants')
      .update({ last_read_message_id: lastMessageId })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }
}

export async function fetchMessages(conversationId: string, limit = 80): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('messages')
    .select('*, attachments(*)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data ?? []) as ChatMessage[];
}
