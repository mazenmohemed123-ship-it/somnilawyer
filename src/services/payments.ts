import { supabase } from './supabase';

interface CheckoutResult {
  url?: string;
  payment_id?: string;
  error?: string;
}

// Creates a pending payment + returns a checkout URL. The amount is sent in the
// base unit (e.g. EGP). The edge function multiplies by 100 for Paymob — never multiply on the frontend.
export async function createCheckout(opts: {
  kind: 'subscription' | 'case_payment';
  amount: number;
  currency: string;
  tier?: 'pro' | 'team';
  case_id?: string;
  coupon?: string;
  months?: number;
}): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: opts });
  if (error) return { error: error.message };
  return data as CheckoutResult;
}

export const PLANS = [
  {
    tier: 'free' as const,
    name: 'مجاني',
    price: 0,
    features: ['حتى 5 قضايا', 'تسجيل صوتي أساسي', 'شات مع الموكلين', 'بوابة الموكل'],
  },
  {
    tier: 'pro' as const,
    name: 'احترافي',
    price: 299,
    features: ['قضايا غير محدودة', 'رفع ملفات (2GB/يوم)', 'إشعارات Push', 'فواتير', 'أدوات الذكاء (تلخيص/تفريغ صوتي/OCR)'],
  },
  {
    tier: 'team' as const,
    name: 'الفريق',
    price: 799,
    features: ['كل مزايا الاحترافي', 'موظفون غير محدودين', 'شات داخلي للفريق', 'رفع غير محدود', 'المساعد القانوني الذكي', 'لوحة التقارير'],
  },
];
