// Lightweight i18n for the client portal (ar default; en/fr/tr supported).
export type Lang = 'ar' | 'en' | 'fr' | 'tr';

type Dict = Record<string, string>;

const ar: Dict = {
  lawyer_login: 'دخول المحامي',
  office_link: 'رابط المكتب',
  enter_phone: 'أدخل رقم هاتفك',
  phone: 'رقم الهاتف',
  enter: 'دخول',
  not_registered: 'رقمك غير مسجّل، تواصل مع المكتب',
  assistant_bot: 'المساعد الآلي',
  chat_with_lawyer: 'التواصل مع المحامي',
  emergency: 'طوارئ',
  book_appointment: 'حجز موعد',
  payment: 'الدفع',
  send: 'إرسال',
  message: 'اكتب رسالة',
  appointments: 'المواعيد',
  cases: 'القضايا',
  loading: 'جارٍ التحميل',
};

const en: Dict = {
  lawyer_login: 'Lawyer Login',
  office_link: 'Office Link',
  enter_phone: 'Enter your phone number',
  phone: 'Phone number',
  enter: 'Enter',
  not_registered: 'Your number is not registered. Please contact the office.',
  assistant_bot: 'Assistant Bot',
  chat_with_lawyer: 'Chat with lawyer',
  emergency: 'Emergency',
  book_appointment: 'Book appointment',
  payment: 'Payment',
  send: 'Send',
  message: 'Type a message',
  appointments: 'Appointments',
  cases: 'Cases',
  loading: 'Loading',
};

const fr: Dict = {
  ...en,
  lawyer_login: 'Connexion avocat',
  office_link: 'Lien du cabinet',
  enter_phone: 'Entrez votre numéro',
  phone: 'Numéro de téléphone',
  enter: 'Entrer',
  not_registered: "Votre numéro n'est pas enregistré. Contactez le cabinet.",
  chat_with_lawyer: "Discuter avec l'avocat",
  emergency: 'Urgence',
  book_appointment: 'Prendre rendez-vous',
  payment: 'Paiement',
  send: 'Envoyer',
  message: 'Écrire un message',
};

const tr: Dict = {
  ...en,
  lawyer_login: 'Avukat Girişi',
  office_link: 'Ofis Bağlantısı',
  enter_phone: 'Telefon numaranızı girin',
  phone: 'Telefon numarası',
  enter: 'Giriş',
  not_registered: 'Numaranız kayıtlı değil. Lütfen ofisle iletişime geçin.',
  chat_with_lawyer: 'Avukatla sohbet',
  emergency: 'Acil',
  book_appointment: 'Randevu al',
  payment: 'Ödeme',
  send: 'Gönder',
  message: 'Mesaj yazın',
};

const dicts: Record<Lang, Dict> = { ar, en, fr, tr };

export function makeT(lang: Lang) {
  const d = dicts[lang] || ar;
  return (key: string) => d[key] ?? ar[key] ?? key;
}

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'tr', label: 'Türkçe' },
];
