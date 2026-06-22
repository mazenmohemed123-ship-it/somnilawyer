import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// إنشاء تطبيق Firebase
const app = initializeApp(firebaseConfig);

// الحصول على Firestore
export const db = getFirestore(app);

// ==================== Cases ==================== //

export interface Case {
  id?: string;
  lawyer_id: string;
  case_number: string;
  client_name: string;
  client_phone?: string;
  case_type?: string;
  verdict?: string;
  fees?: number;
  expenses?: number;
  status: 'active' | 'closed' | 'archived';
  created_at: Timestamp;
  updated_at: Timestamp;
}

// إضافة قضية جديدة
export async function addCase(lawyerId: string, caseData: Omit<Case, 'id' | 'created_at' | 'updated_at'>) {
  return addDoc(collection(db, 'cases'), {
    ...caseData,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
}

// تحديث القضية
export async function updateCase(caseId: string, updates: Partial<Case>) {
  return updateDoc(doc(db, 'cases', caseId), {
    ...updates,
    updated_at: Timestamp.now(),
  });
}

// حذف القضية
export async function deleteCase(caseId: string) {
  return deleteDoc(doc(db, 'cases', caseId));
}

// الاستماع لقضايا المحامي (Realtime)
export function subscribeToCases(
  lawyerId: string,
  callback: (cases: (Case & { id: string })[]) => void
) {
  const q = query(
    collection(db, 'cases'),
    where('lawyer_id', '==', lawyerId),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const cases = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Case & { id: string }));
    callback(cases);
  });
}

// ==================== Chat Messages ==================== //

export interface ChatMessage {
  id?: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  type: 'text' | 'image' | 'file';
  file_url?: string;
  created_at: Timestamp;
  read_by: string[];
}

// إرسال رسالة
export async function sendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  content: string
) {
  return addDoc(collection(db, `chats/${chatId}/messages`), {
    chat_id: chatId,
    sender_id: senderId,
    sender_name: senderName,
    content,
    type: 'text',
    created_at: Timestamp.now(),
    read_by: [senderId],
  });
}

// الاستماع لرسائل الشات (Realtime)
export function subscribeToMessages(
  chatId: string,
  callback: (messages: (ChatMessage & { id: string })[]) => void
) {
  const q = query(
    collection(db, `chats/${chatId}/messages`),
    orderBy('created_at', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as ChatMessage & { id: string }));
    callback(messages);
  });
}

// وضع علامة القراءة
export async function markMessageAsRead(chatId: string, messageId: string, userId: string) {
  const msgRef = doc(db, `chats/${chatId}/messages/${messageId}`);
  const msgData = await (await import('firebase/firestore')).getDoc(msgRef);
  const readBy = msgData.data()?.read_by || [];

  if (!readBy.includes(userId)) {
    return updateDoc(msgRef, {
      read_by: [...readBy, userId],
    });
  }
}

// ==================== Documents ==================== //

export interface Document {
  id?: string;
  case_id: string;
  lawyer_id: string;
  name: string;
  url: string;
  type: string;
  size_bytes: number;
  created_at: Timestamp;
}

// إضافة مستند
export async function addDocument(lawyerId: string, caseId: string, doc: Omit<Document, 'id' | 'created_at'>) {
  return addDoc(collection(db, 'documents'), {
    ...doc,
    lawyer_id: lawyerId,
    case_id: caseId,
    created_at: Timestamp.now(),
  });
}

// الاستماع لمستندات القضية (Realtime)
export function subscribeToDocuments(
  caseId: string,
  callback: (documents: (Document & { id: string })[]) => void
) {
  const q = query(
    collection(db, 'documents'),
    where('case_id', '==', caseId),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Document & { id: string }));
    callback(documents);
  });
}

// حذف المستند
export async function deleteDocument(docId: string) {
  return deleteDoc(doc(db, 'documents', docId));
}

// ==================== Notifications ==================== //

export interface Notification {
  id?: string;
  user_id: string;
  title: string;
  body: string;
  type: 'case_update' | 'message' | 'appointment' | 'system';
  read: boolean;
  created_at: Timestamp;
  action_url?: string;
}

// إرسال إشعار
export async function sendNotification(
  userId: string,
  title: string,
  body: string,
  type: Notification['type']
) {
  return addDoc(collection(db, `notifications/${userId}/items`), {
    title,
    body,
    type,
    read: false,
    created_at: Timestamp.now(),
  });
}

// الاستماع للإشعارات (Realtime)
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: (Notification & { id: string })[]) => void
) {
  const q = query(
    collection(db, `notifications/${userId}/items`),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Notification & { id: string }));
    callback(notifications);
  });
}

// وضع علامة على الإشعار كمقروء
export async function markNotificationAsRead(userId: string, notificationId: string) {
  return updateDoc(doc(db, `notifications/${userId}/items/${notificationId}`), {
    read: true,
  });
}

// ==================== Batch Operations ==================== //

export async function batchUpdateCases(updates: { caseId: string; data: Partial<Case> }[]) {
  const batch = (await import('firebase/firestore')).writeBatch(db);
  updates.forEach(({ caseId, data }) => {
    batch.update(doc(db, 'cases', caseId), {
      ...data,
      updated_at: Timestamp.now(),
    });
  });
  return batch.commit();
}

// ==================== Helper Functions ==================== //

// تنسيق التاريخ
export function formatTimestamp(timestamp: Timestamp): string {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp.toDate());
}

// الفرق الزمني (منذ)
export function timeAgo(timestamp: Timestamp): string {
  const now = Timestamp.now();
  const seconds = (now.seconds - timestamp.seconds);

  if (seconds < 60) return 'قبل للتو';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  return `منذ ${Math.floor(seconds / 86400)} أيام`;
}
