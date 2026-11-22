# بناء تطبيق نور كملف APK

المشروع مبني باستخدام Capacitor. يوفّر GitHub Actions ملف APK تجريبيًا عند الدفع إلى الفرع `main` أو فرع التجهيز.

## تنزيل APK من GitHub

1. افتح تبويب [Actions](https://github.com/abdozidan512-byte/adhkarapp/actions).
2. اختر تشغيل **Build Android APK** الناجح.
3. نزّل الأثر `noor-debug-apk` من أسفل صفحة التشغيل.
4. فك الضغط وثبّت `app-debug.apk` على جهاز Android.

## البناء محليًا

المتطلبات: Node.js 22 أو أحدث، Android Studio وAndroid SDK، وJDK 21.

```bash
npm ci
npm run build
npx cap add android   # مرة واحدة عند غياب مجلد android
npx cap sync android
cd android
./gradlew assembleDebug
```

يوجد APK الناتج في `android/app/build/outputs/apk/debug/app-debug.apk`.

لإعداد إصدار موقّع للنشر، أضف مفاتيح التوقيع بأمان إلى بيئة البناء، ثم أنشئ إصدار Release. لا تضع مفاتيح التوقيع في المستودع.

## ملاحظات

- الأذكار والقرآن المحفوظان محليًا متاحان دون اتصال.
- تلاوات القراء تحتاج اتصالًا عند الاستخدام الأول أو تنزيلها مسبقًا.
- إشعارات التذكير تعتمد على إذن الإشعارات في Android.
