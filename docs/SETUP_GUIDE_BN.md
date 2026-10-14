> **Note:** This document predates the React rewrite and may be outdated (it may mention the removed Flutter app). The current, maintained documentation is in [docs/ai/](ai/README.md).

# প্রজেক্ট সেটআপ ও রান করার সম্পূর্ণ নির্দেশিকা (Setup Guide in Bangla)

এই ফাইলটিতে **Smart Workforce & Task Allocation System** প্রজেক্টটি লোকাল পিসিতে সেটআপ এবং রান করার ধাপগুলো সহজ বাংলায় তুলে ধরা হলো।

---

## ১ম ধাপ: ব্যাকএন্ড সার্ভার ও ডেটাবেজ সেটআপ (Node.js REST API & SQLite)

PowerShell-এ প্রজেক্টের ব্যাকএন্ড ফোল্ডারে যান:

```powershell
cd "C:\Users\DEll\OneDrive\Desktop\smart_workflow\backend"
```

১. প্রয়োজনীয় প্যাকেজগুলো ইন্সটল করতে লিখুন:
```powershell
npm install
```

২. `.env` ফাইলে পোর্ট ও ডেটাবেজ কনফিগারেশন চেক করুন (Port: 5000):
```env
PORT=5000
NODE_ENV=development
DB_FILE=smart_workflow.db
JWT_SECRET=super_secret_jwt_key_change_in_production_32chars
JWT_EXPIRES_IN=24h
```

৩. টেস্ট রান করতে লিখুন:
```powershell
npm test
```

৪. ডেটাবেজ সিড করতে লিখুন:
```powershell
npm run seed
```

৫. ব্যাকএন্ড সার্ভার স্টার্ট করতে লিখুন:
```powershell
npm start
```
*আউটপুট দেখাবে: `Listening on: http://0.0.0.0:5000`*

---

## ২য় ধাপ: ফ্রন্টএন্ড রান (Flutter Mobile App)

PowerShell-এ রুট প্রজেক্ট ফোল্ডারে যান:

```powershell
cd "C:\Users\DEll\OneDrive\Desktop\smart_workflow"
```

১. ডার্ট ডিপেন্ডেন্সি চেক করতে লিখুন:
```powershell
dart pub get --offline
```

২. অ্যান্ড্রয়েড এমুলেটর, ওয়েব বা ডেস্কটপে অ্যাপ রান করতে লিখুন:
```powershell
flutter run
```

---

## ৩য় ধাপ: টেস্ট অ্যাকাউন্টসমূহ (Login Credentials)

- **Administrator Login:**
  - Email: `admin@smartworkflow.org`
  - Password: `password123`
- **Employee Login:**
  - Email: `john.doe@smartworkflow.org`
  - Password: `password123`
