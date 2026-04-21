# بناء تطبيق نور كملف APK

التطبيق جاهز للتحويل إلى APK باستخدام Capacitor. اتبع الخطوات على جهازك:

## المتطلبات
- Node.js 18+
- Android Studio (مع Android SDK)
- JDK 17

## الخطوات

```bash
# 1. صدّر المشروع من Lovable إلى GitHub ثم استنسخه
git clone <your-repo-url>
cd <project>

# 2. ثبّت المكتبات
npm install

# 3. أضف منصة أندرويد (مرة واحدة فقط)
npx cap add android

# 4. ابنِ الويب
npm run build

# 5. زامن الملفات مع أندرويد
npx cap sync android

# 6. افتح في Android Studio
npx cap open android
```

## بناء APK

داخل Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- ستجد الملف في: `android/app/build/outputs/apk/debug/app-debug.apk`

أو من الطرفية:
```bash
cd android
./gradlew assembleDebug
```

## بناء APK موقّع للنشر

```bash
cd android
./gradlew assembleRelease
```

## ملاحظات مهمة
- **التطبيق يعمل بدون إنترنت** للمصحف والأذكار (مخزّن محلياً عبر IndexedDB).
- **تلاوات القراء** تحتاج إنترنت أول مرة، ثم يمكن تنزيلها للاستماع لاحقاً بدون نت.
- **الإشعارات** تستخدم `@capacitor/local-notifications` وتعمل مثل إشعارات الواتساب.
- في كل مرة تعدّل الكود: `npm run build && npx cap sync android`.
