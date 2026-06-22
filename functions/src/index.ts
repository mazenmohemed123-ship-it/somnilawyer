import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // For deployed functions, credential is auto-detected
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// ============================================
// 1. CREATE CHECKOUT SESSION (Paymob)
// ============================================
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');

  const { tier, currency } = data;
  const userId = context.auth.uid;

  // Exchange rates (keep in sync with frontend)
  const RATES: Record<string, number> = {
    USD: 1, EGP: 50, EUR: 0.92, SAR: 3.75, AED: 3.67, TRY: 32.5, MAD: 10, DZD: 133,
    TND: 3.15, LYD: 4.8, QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.385, JOD: 0.71, GBP: 0.79, CAD: 1.36, AUD: 1.52
  };
  const USD_PRICE: Record<string, number> = { pro: 20, team: 50 };
  const rate = RATES[currency] ?? 1;
  const amount = Math.round(USD_PRICE[tier as keyof typeof USD_PRICE] * rate * 100); // in cents

  try {
    // Initialize Paymob API auth
    const authRes = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: process.env.PAYMOB_API_KEY,
    });
    const authToken = authRes.data.token;

    // Create order
    const orderRes = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
      auth_token: authToken,
      delivery_needed: false,
      currency: currency,
      amount_cents: amount,
      merchant_order_id: `${userId}_${tier}_${Date.now()}`,
      items: [{ name: `${tier.toUpperCase()} Plan`, description: `Somni Lawyer ${tier} tier for ${currency}`, amount_cents: amount, quantity: 1 }],
    });
    const orderId = orderRes.data.id;

    // Create payment key
    const payRes = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
      auth_token: authToken,
      amount_cents: amount,
      expiration: 3600,
      order_id: orderId,
      billing_data: { email: (await db.collection('users').doc(userId).get()).data()?.email },
      currency: currency,
      integration_id: process.env.PAYMOB_INTEGRATION_ID,
    });
    const paymentKey = payRes.data.token;

    // Store order in Firestore for webhook tracking
    await db.collection('orders').add({
      user_id: userId,
      tier,
      currency,
      amount: amount / 100,
      order_id: orderId,
      payment_key: paymentKey,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    return { success: true, paymentKey, orderId };
  } catch (error: any) {
    console.error('Paymob error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 2. PAYMOB WEBHOOK
// ============================================
export const paymobWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const { obj } = req.body;
    if (!obj || obj.success !== true) {
      res.status(400).send('Payment failed or invalid');
      return;
    }

    const merchantOrderId = obj.merchant_order_id;
    const [userId, tier] = merchantOrderId.split('_');

    // Find the order in Firestore
    const snap = await db.collection('orders').where('order_id', '==', obj.order).limit(1).get();
    if (snap.empty) {
      res.status(404).send('Order not found');
      return;
    }

    const orderId = snap.docs[0].id;
    const orderData = snap.docs[0].data();

    // Update order status
    await db.collection('orders').doc(orderId).update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      transaction_id: obj.id,
    });

    // Upgrade user tier
    const daysMap: Record<string, number> = { pro: 30, team: 30 };
    const days = daysMap[tier] || 30;
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

    await db.collection('users').doc(userId).update({
      tier: tier,
      tier_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    // Log payment
    await db.collection('payments').add({
      user_id: userId,
      tier,
      amount: orderData.amount,
      currency: orderData.currency,
      status: 'paid',
      transaction_id: obj.id,
      created_at: new Date().toISOString(),
    });

    res.status(200).send({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).send(error.message);
  }
});

// ============================================
// 3. AI TOOLS (Hugging Face)
// ============================================
export const aiTools = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');

  const { task, payload } = data;
  const userId = context.auth.uid;
  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

  if (!HF_API_KEY) {
    throw new functions.https.HttpsError('internal', 'HF API key not configured');
  }

  try {
    // Check daily AI usage limits
    const today = new Date().toISOString().split('T')[0];
    const usageSnap = await db.collection('ai_usage').where('user_id', '==', userId).where('date', '==', today).get();
    const usage = usageSnap.empty ? { count: 0 } : usageSnap.docs[0].data();

    const limits: Record<string, number> = { free: 5, pro: 50, team: 200 };
    const userSnap = await db.collection('users').doc(userId).get();
    const userTier = userSnap.data()?.tier || 'free';
    const limit = limits[userTier] || 5;

    if (usage.count >= limit) {
      throw new functions.https.HttpsError('resource-exhausted', `Daily limit of ${limit} requests reached`);
    }

    let result: any = null;

    if (task === 'transcribe') {
      // Audio transcription via Hugging Face ASR
      const { audioUrl } = payload;
      const hfRes = await axios.post(
        'https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo',
        { data: audioUrl },
        { headers: { Authorization: `Bearer ${HF_API_KEY}` }, timeout: 60000 }
      );
      result = hfRes.data;
    } else if (task === 'ocr') {
      // Image text extraction
      const { imageUrl } = payload;
      const hfRes = await axios.post(
        'https://api-inference.huggingface.co/models/microsoft/trocr-large-printed',
        { data: imageUrl },
        { headers: { Authorization: `Bearer ${HF_API_KEY}` }, timeout: 60000 }
      );
      result = hfRes.data;
    } else if (task === 'summarize') {
      // Text summarization
      const { text } = payload;
      const hfRes = await axios.post(
        'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
        { inputs: text },
        { headers: { Authorization: `Bearer ${HF_API_KEY}` }, timeout: 60000 }
      );
      result = hfRes.data?.[0]?.summary_text || text;
    } else if (task === 'chat') {
      // Legal assistant via text generation
      const { message } = payload;
      const hfRes = await axios.post(
        'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta',
        { inputs: `You are a helpful legal assistant. Answer this question: ${message}` },
        { headers: { Authorization: `Bearer ${HF_API_KEY}` }, timeout: 60000 }
      );
      result = hfRes.data?.[0]?.generated_text || 'Unable to generate response';
    }

    // Increment usage count
    if (usageSnap.empty) {
      await db.collection('ai_usage').add({ user_id: userId, date: today, count: 1 });
    } else {
      await db.collection('ai_usage').doc(usageSnap.docs[0].id).update({ count: usage.count + 1 });
    }

    return { success: true, result };
  } catch (error: any) {
    console.error('AI error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 4. SEND NOTIFICATION (FCM)
// ============================================
export const sendNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid === context.auth?.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Must be called by admin or system');
  }

  const { userId, title, body, data: notifData } = data;

  try {
    const userSnap = await db.collection('users').doc(userId).get();
    const fcmToken = userSnap.data()?.fcm_token;

    if (!fcmToken) {
      throw new functions.https.HttpsError('not-found', 'User has no FCM token');
    }

    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: notifData || {},
    });

    return { success: true };
  } catch (error: any) {
    console.error('FCM error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 5. AUTO RENEW CHECK (Scheduled)
// ============================================
export const autoRenewCheck = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    const now = new Date().toISOString();
    const snap = await db.collection('users')
      .where('tier', 'in', ['pro', 'team'])
      .where('tier_expires_at', '<=', now)
      .get();

    for (const doc of snap.docs) {
      await db.collection('users').doc(doc.id).update({
        tier: 'free',
        tier_expires_at: null,
        updated_at: now,
      });

      console.log(`Downgraded user ${doc.id} to free tier`);
    }

    return null;
  } catch (error: any) {
    console.error('Auto renew error:', error);
    return null;
  }
});

// ============================================
// 6. SEND EMAIL (Resend)
// ============================================
export const sendEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');

  const { to, subject, html } = data;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    throw new functions.https.HttpsError('internal', 'Resend API key not configured');
  }

  try {
    const res = await axios.post(
      'https://api.resend.com/emails',
      {
        from: 'noreply@somnilawyer.com',
        to,
        subject,
        html,
      },
      {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      }
    );

    return { success: true, messageId: res.data.id };
  } catch (error: any) {
    console.error('Resend error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
