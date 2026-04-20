import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { QiblaCompass } from "@/components/QiblaCompass";

export const Route = createFileRoute("/qibla")({
  component: QiblaPage,
  head: () => ({
    meta: [{ title: "اتجاه القبلة — نور" }, { name: "description", content: "حدّد اتجاه القبلة بدقة باستخدام بوصلة الجوال." }],
  }),
});

function QiblaPage() {
  return (
    <div>
      <PageHeader title="اتجاه القبلة" subtitle="ضع الجوال أفقياً وابعد عن المعادن" />
      <div className="px-5 py-10">
        <QiblaCompass />
        <div className="mt-10 rounded-3xl border p-5 text-sm" style={{ background: "var(--gradient-card)" }}>
          <p className="font-bold">كيفية الاستخدام:</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>1. اسمح بالوصول للموقع وبيانات الاتجاه.</li>
            <li>2. ضع الجوال أفقياً (مسطحاً).</li>
            <li>3. ابتعد عن المعادن والأجهزة الإلكترونية.</li>
            <li>4. اتجه حتى يضيء سهم القبلة بالذهبي.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
