# OTP System — Complete Guide

## How OTP Works in the Digital Banking System

### Real Bank Flow (What We're Simulating)

In a production banking system:

1. **Customer requests OTP** → clicks "Send OTP Code"
2. **Banking system generates 6-digit code** → stores hashed version in database
3. **SMS/Email gateway sends code** → customer receives it on their phone/email
4. **Customer enters code** → system verifies and marks as used
5. **Account verified** → customer can use all services

---

## Our Demo Implementation

### Backend (`src/routes/otp.js` + `src/services/otpService.js`)

**What happens when customer clicks "Send OTP":**

```
POST /api/otp/send
Body: { purpose: "PHONE_VERIFICATION" }

Backend:
1. Generates random 6-digit code (e.g. "274819")
2. Hashes it with bcrypt
3. Stores in `otp_tokens` table with 10-minute expiry
4. In DEV mode: returns the plaintext code in the response
5. In PRODUCTION: sends via real SMS/email gateway
```

**Response in development:**
```json
{
  "status": "ok",
  "purpose": "PHONE_VERIFICATION",
  "masked_phone": "+251911***001",
  "masked_email": "ab***@example.com",
  "dev_otp": "274819",
  "dev_note": "SIMULATION — In production delivered via SMS/email gateway"
}
```

**Response in production:**
```json
{
  "status": "ok",
  "purpose": "PHONE_VERIFICATION",
  "masked_phone": "+251911***001",
  "masked_email": "ab***@example.com",
  "message": "OTP sent to your registered phone number"
}
```

---

### Frontend (`public/js/views/customer.js`)

**Current state:**
- Shows a simulated SMS/email notification on screen
- Displays the 6-digit code exactly like a real phone would show it
- Auto-fills the input for demo convenience
- Shows masked phone number (e.g. `+251911***001`)

**What it looks like:**

#### Phone SMS Mode:
```
┌─────────────────────────────────┐
│ 📱 SMS Delivered to +251911***001│
│                                 │
│ [Dark phone screen with]        │
│ [WhatsApp-style SMS bubble]     │
│                                 │
│ Your DigitalBank ETB            │
│ verification code is:           │
│                                 │
│       2  7  4  8  1  9          │
│     (big gold digits)           │
│                                 │
│ Valid for 10 minutes.           │
└─────────────────────────────────┘
⚠️ Simulation — in production
   sent via SMS to +251911***001
```

#### Email Mode:
```
┌─────────────────────────────────┐
│ 📧 Email Delivered to ab***@... │
│                                 │
│ From: DigitalBank ETB           │
│ Subject: Your Verification Code │
│                                 │
│ Dear Customer,                  │
│                                 │
│  ┌──────────────────────────┐   │
│  │    2  7  4  8  1  9      │   │
│  └──────────────────────────┘   │
│                                 │
│ Expires in 10 minutes.         │
└─────────────────────────────────┘
```

---

## Testing the OTP System

### 1. Start the server
```bash
npm start
```

### 2. As a customer (Abebe)
1. Login at `http://localhost:3000/login.html`
2. Click **📱 Verify Account** in sidebar
3. Choose **📞 Phone Number** or **📧 Email Address**
4. Click **Send OTP Code**
5. See the realistic phone/email simulation appear on screen
6. The 6-digit code is auto-filled in the input
7. Click **✔ Verify OTP**
8. Success! ✅ Account verified

### 3. Resend OTP
- Click **🔄 Resend Code** if the code expired
- A new code is generated and displayed

---

## Database Structure

```sql
CREATE TABLE otp_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  application_id INT NULL,
  purpose ENUM('PHONE_VERIFICATION', 'EMAIL_VERIFICATION', 'APPLICATION_APPROVAL'),
  token_hash VARCHAR(255) NOT NULL,  -- bcrypt hashed OTP
  expires_at DATETIME NOT NULL,      -- 10 minutes from creation
  is_used TINYINT DEFAULT 0,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Security features:**
- OTP is **hashed** with bcrypt before storage (plaintext never stored)
- **10-minute expiry** enforced at database and application level
- **One-time use** — marked as used after successful verification
- Previous unused OTPs for same user+purpose are invalidated when new one is sent

---

## Production Deployment Checklist

When deploying to production with a real SMS/email gateway:

### 1. Install gateway SDK
```bash
npm install twilio           # for SMS
# OR
npm install africastalking   # for SMS in Africa
# OR
npm install @sendgrid/mail   # for Email
```

### 2. Update `src/routes/otp.js`

After generating the OTP, add:

```javascript
const plaintext = await createOTP(req.user.id, purpose, application_id);

// ✅ ADD THIS for production SMS delivery
if (process.env.NODE_ENV === 'production' && purpose === 'PHONE_VERIFICATION') {
  const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await twilio.messages.create({
    body: `Your DigitalBank ETB verification code is: ${plaintext}. Valid for 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: app.phone,
  });
}

// ✅ ADD THIS for production email delivery
if (process.env.NODE_ENV === 'production' && purpose === 'EMAIL_VERIFICATION') {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to: app.email || req.user.email,
    from: 'noreply@digitalbank.et',
    subject: 'Your DigitalBank ETB Verification Code',
    html: `<p>Your verification code is: <strong>${plaintext}</strong></p>
           <p>This code expires in 10 minutes.</p>`,
  });
}
```

### 3. Environment variables
```env
# .env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

SENDGRID_API_KEY=SG.xxxxxxxxxx
```

### 4. Remove dev_otp from response
The response already conditionally excludes `dev_otp` in production, so no changes needed.

---

## Current Status

✅ OTP generation and hashing working
✅ Database storage with expiry working
✅ Verification logic working
✅ Demo mode shows realistic phone/email simulation
✅ Masked phone numbers and emails displayed
✅ Auto-fill in demo for convenience
✅ Resend functionality working
⏳ **TODO for production:** Integrate real SMS/email gateway

---

## Files Modified

1. `src/routes/otp.js` — Returns masked contact info and dev_otp in dev mode
2. `src/services/otpService.js` — Generates and verifies OTPs
3. `public/js/views/customer.js` — Renders realistic phone/email UI
4. `public/js/components/sidebar.js` — Added "Verify Account" link for customers

---

## Questions?

- **"Where does the OTP appear?"** — On the customer's screen in a realistic phone/SMS style notification (dev mode). In production it goes to their actual phone/email.
- **"Can I test without looking at the server console?"** — Yes! The OTP appears right on screen in the Verify Account page.
- **"Is it secure?"** — Yes. The OTP is hashed before storage, expires in 10 minutes, and can only be used once.
- **"How do I integrate a real SMS gateway?"** — Follow the Production Deployment Checklist above.
