import type { Profile, Role, Tier } from '@/types';

// Daily upload limits (bytes) per tier.
export const UPLOAD_LIMITS: Record<Tier, number> = {
  free: 50 * 1024 * 1024, // 50 MB
  pro: 2 * 1024 * 1024 * 1024, // 2 GB
  team: Number.POSITIVE_INFINITY, // unlimited
};

export const FREE_CASE_LIMIT = 5;

export const STAFF_ROLES: Role[] = ['partner', 'lawyer', 'assistant', 'secretary', 'accountant'];

export const ADMIN_ALLOWLIST = ['mazenmohemed123@gmail.com'];

export function isLawyerSide(role: Role): boolean {
  return role === 'owner' || STAFF_ROLES.includes(role);
}

export function tierRank(tier: Tier): number {
  return tier === 'team' ? 2 : tier === 'pro' ? 1 : 0;
}

// Feature gates
export function canUploadInChat(p: Profile | null): boolean {
  return !!p && tierRank(p.tier) >= 1; // pro+
}

export function canUseAI(p: Profile | null): boolean {
  return !!p && tierRank(p.tier) >= 1; // summarize/asr/ocr => pro+
}

export function canUseLegalAssistant(p: Profile | null): boolean {
  // Legal assistant chat: Team plan, lawyers only.
  return !!p && p.tier === 'team' && (p.role === 'owner' || p.role === 'lawyer' || p.role === 'partner');
}

export function canManageTeam(p: Profile | null): boolean {
  return !!p && p.tier === 'team' && (p.role === 'owner' || p.role === 'partner');
}

export function canTeamChat(p: Profile | null): boolean {
  return !!p && p.tier === 'team';
}

export function caseLimit(tier: Tier): number {
  return tier === 'free' ? FREE_CASE_LIMIT : Number.POSITIVE_INFINITY;
}

export function dailyUploadLimit(tier: Tier): number {
  return UPLOAD_LIMITS[tier];
}

// Staff permission helpers (owner always allowed)
export function canViewBilling(p: Profile | null): boolean {
  return !!p && (p.role === 'owner' || p.can_view_billing);
}
export function canManageAppointments(p: Profile | null): boolean {
  return !!p && (p.role === 'owner' || p.can_manage_appointments || p.role === 'secretary');
}
export function canEditDocuments(p: Profile | null): boolean {
  return !!p && (p.role === 'owner' || p.can_edit_documents);
}
export function canReplyClientChats(p: Profile | null): boolean {
  return !!p && (p.role === 'owner' || p.can_reply_client_chats || p.role === 'secretary' || p.role === 'lawyer');
}

export function tierLabel(tier: Tier): string {
  return tier === 'team' ? 'الفريق' : tier === 'pro' ? 'احترافي' : 'مجاني';
}

export function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    owner: 'المحامي الرئيسي',
    partner: 'شريك',
    lawyer: 'محامٍ',
    assistant: 'مساعد',
    secretary: 'سكرتير',
    accountant: 'محاسب',
    client: 'موكل',
    admin: 'مشرف',
  };
  return map[role];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_ALLOWLIST.includes(email.toLowerCase());
}
