import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

interface CheckoutResult {
  url?: string; // Paymob iframe URL to embed
  paymentKey?: string;
  orderId?: string;
  amount?: number; // final amount after coupon (in currency units)
  error?: string;
}

export async function createCheckout(opts: {
  kind: 'subscription' | 'case_payment';
  amount: number;
  currency: string;
  tier?: 'pro' | 'team';
  case_id?: string;
  coupon?: string;
  months?: number;
}): Promise<CheckoutResult> {
  try {
    const fn = httpsCallable<typeof opts, CheckoutResult>(functions, 'createCheckoutSession');
    const res = await fn(opts);
    return res.data;
  } catch (e: any) {
    return { error: e.message ?? 'تعذّر بدء الدفع' };
  }
}

// USD base prices
const USD_PRICE = { pro: 20, team: 50 };

// Approximate exchange rates to USD
const RATES: Record<string, number> = {
  USD: 1, EGP: 50, EUR: 0.92, SAR: 3.75, AED: 3.67,
  TRY: 34, MAD: 10, DZD: 135, TND: 3.1, LYD: 4.8,
  QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.38, JOD: 0.71,
  GBP: 0.79, CAD: 1.36, AUD: 1.54,
};

export function getPlanPrice(tier: 'pro' | 'team', currency: string): number {
  const rate = RATES[currency] ?? 1;
  return Math.round(USD_PRICE[tier] * rate);
}

export function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return 'مجاني';
  try {
    return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export const PLANS = [
  {
    tier: 'free' as const,
    name: 'مجاني',
    usdPrice: 0,
    features: ['حتى 5 قضايا', 'تسجيل صوتي أساسي', 'شات مع الموكلين', 'بوابة الموكل'],
  },
  {
    tier: 'pro' as const,
    name: 'احترافي',
    usdPrice: 20,
    features: ['قضايا غير محدودة', 'رفع ملفات (2GB/يوم)', 'إشعارات Push', 'فواتير', 'أدوات الذكاء (تلخيص/تفريغ صوتي/OCR)'],
  },
  {
    tier: 'team' as const,
    name: 'الفريق',
    usdPrice: 50,
    features: ['كل مزايا الاحترافي', 'موظفون غير محدودين', 'شات داخلي للفريق', 'رفع غير محدود', 'المساعد القانوني الذكي', 'لوحة التقارير'],
  },
];
