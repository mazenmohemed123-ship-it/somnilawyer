# Firebase Cloud Functions Setup

This directory contains the Cloud Functions for the Somni Avocate application.

## Prerequisites

1. Node.js 20+
2. Firebase CLI: `npm install -g firebase-tools`
3. Firebase project set up

## Installation

```bash
cd functions
npm install
```

## Environment Variables

Create a `.env.local` file in the functions directory with the following variables:

```env
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID=your_paymob_integration_id
HUGGINGFACE_API_KEY=your_huggingface_api_key
RESEND_API_KEY=your_resend_api_key
```

For production, set these via Firebase console:
- Go to Firebase Console → Project Settings → Functions
- Add environment variables in the deployment settings

## Functions

### 1. createCheckoutSession
- **Type**: HTTPS Callable
- **Auth**: Required
- **Purpose**: Initialize Paymob payment session
- **Params**: `{ tier: 'pro' | 'team', currency: string }`
- **Returns**: `{ success: boolean, paymentKey: string, orderId: string }`

### 2. paymobWebhook
- **Type**: HTTPS Function
- **Auth**: None (webhook from Paymob)
- **Purpose**: Handle payment status callback from Paymob
- **Trigger**: POST request from Paymob
- **Actions**: Update order status, upgrade user tier, log payment

### 3. aiTools
- **Type**: HTTPS Callable
- **Auth**: Required
- **Purpose**: Call Hugging Face AI APIs with usage limits
- **Params**: `{ task: 'transcribe' | 'ocr' | 'summarize' | 'chat', payload: {...} }`
- **Usage Limits**: 
  - Free tier: 5 requests/day
  - Pro tier: 50 requests/day
  - Team tier: 200 requests/day

### 4. sendNotification
- **Type**: HTTPS Callable
- **Auth**: Admin or system
- **Purpose**: Send FCM push notifications
- **Params**: `{ userId: string, title: string, body: string, data?: {...} }`

### 5. autoRenewCheck
- **Type**: Scheduled (runs every hour)
- **Purpose**: Check for expired tier subscriptions and downgrade to free
- **Trigger**: Cloud Scheduler (automatic)

### 6. sendEmail
- **Type**: HTTPS Callable
- **Auth**: Required
- **Purpose**: Send emails via Resend API
- **Params**: `{ to: string, subject: string, html: string }`

## Local Development

Start the Firebase emulator:

```bash
firebase emulators:start --only functions
```

Or run just the functions:

```bash
npm run build && npm run start
```

## Deployment

Deploy functions to Firebase:

```bash
firebase deploy --only functions
```

Deploy specific function:

```bash
firebase deploy --only functions:createCheckoutSession
```

View logs:

```bash
firebase functions:log
```

## Paymob Integration

### Webhook URL
Set your Paymob webhook URL to:
```
https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/paymobWebhook
```

### Order Tracking
Orders are stored in Firestore `orders` collection with:
- `user_id`: User who initiated payment
- `tier`: Plan purchased
- `currency`: Currency used
- `amount`: Amount in local currency
- `status`: 'pending' or 'completed'
- `created_at`: When order was created

## Security

- All callable functions except webhooks require authentication
- Sensitive keys are stored in Firebase environment variables
- Firestore rules prevent unauthorized access to collections
- Functions validate user ownership and permissions before processing

## Troubleshooting

**Function not found error**: Ensure functions are deployed
```bash
firebase deploy --only functions
firebase functions:log
```

**API key errors**: Check that all environment variables are set in Firebase console

**Payment not processing**: Check Paymob webhook configuration and logs
```bash
firebase functions:log --limit=50
```

## TypeScript

Functions are written in TypeScript and compiled to JavaScript. Compile locally:

```bash
npm run build
```

Generated files go to the `lib/` directory.
