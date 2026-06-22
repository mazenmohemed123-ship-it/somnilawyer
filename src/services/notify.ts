import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { functions, db } from '@/services/firebase';
import { postSystemMessage } from '@/services/chat';

// Send a push notification to a specific user (best-effort; never throws).
export async function notifyUser(userId: string, title: string, body: string, data?: Record<string, string>) {
  try {
    const fn = httpsCallable(functions, 'sendNotification');
    await fn({ userId, title, body, data: data ?? {} });
  } catch (e) {
    // Lawyer may not have an FCM token yet — that's fine, the in-app listener still works.
    console.warn('notifyUser failed (non-fatal):', e);
  }
}

// Post an in-chat system message to every conversation tied to a case.
// Used when the lawyer updates a case so the client sees it in their chat.
export async function notifyCaseConversations(caseId: string, lawyerUid: string, text: string) {
  try {
    const snap = await getDocs(query(collection(db, 'conversations'), where('case_id', '==', caseId)));
    await Promise.all(
      snap.docs.map((d) => postSystemMessage(d.id, lawyerUid, text).catch(() => {}))
    );
  } catch (e) {
    console.warn('notifyCaseConversations failed (non-fatal):', e);
  }
}
