// Somni Lawyer — Shared domain types

export type Role =
  | 'owner'
  | 'partner'
  | 'lawyer'
  | 'assistant'
  | 'secretary'
  | 'accountant'
  | 'client'
  | 'admin';

export type Tier = 'free' | 'pro' | 'team';

export interface Profile {
  id: string;
  role: Role;
  tier: Tier;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  language: string;
  bot_language: string;
  voice_recording_language: string;
  currency: string;
  master_lawyer_id: string | null;
  can_view_billing: boolean;
  can_manage_appointments: boolean;
  can_edit_documents: boolean;
  can_reply_client_chats: boolean;
  fcm_token: string | null;
  emergency_enabled: boolean;
  tier_expires_at: string | null;
  vodafone_cash: string | null;
  instapay: string | null;
  bank_account: string | null;
  payment_qr_url: string | null;
  created_at: string;
}

export interface CaseColumn {
  key: string;
  label: string;
}

export interface CaseRow {
  id: string;
  lawyer_id: string;
  case_number: string | null;
  client_name: string | null;
  client_phone: string | null;
  case_type: string | null;
  verdict: string | null;
  fees: number | null;
  expenses: number | null;
  follower_phones: string[];
  extra: Record<string, string>;
  archived: boolean;
  created_at: string;
}

export interface CaseEvent {
  id: string;
  case_id: string;
  lawyer_id: string;
  kind: string;
  title: string;
  body: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AppointmentRequest {
  id: string;
  case_id: string | null;
  lawyer_id: string;
  client_id: string | null;
  client_name: string | null;
  requested_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  note: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  case_id: string | null;
  lawyer_id: string;
  uploader_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'lawyers';
  created_at: string;
}

// ---- somni-chat domain ----
export type ConversationType = 'direct' | 'group' | 'channel' | 'support' | 'ai';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';
export type MessageType = 'text' | 'attachment' | 'system' | 'reply' | 'ai';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  status: 'active' | 'archived' | 'deleted';
  case_id: string | null;
  office_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  status: MessageStatus;
  client_id: string;
  reply_to_id: string | null;
  reply_to_preview: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
  // hydrated client-side
  attachments?: Attachment[];
  _optimistic?: boolean;
}

export interface Attachment {
  id: string;
  message_id: string;
  file_url: string;
  file_name: string;
  file_type: 'image' | 'video' | 'audio' | 'document' | 'other';
  mime_type: string;
  file_size: number;
  thumbnail_url: string | null;
  created_at: string;
}
