import { useEffect, useRef, useState } from "react";
import { Compass as CompassIcon, MapPin, Loader2, RefreshCw } from "lucide-react";
import { calculateQiblaDirection, distanceToKaabaKm } from "@/lib/qibla";
import { getUserCoords } from "@/lib/prayer";

// تنعيم الزاوية: متوسط متحرك أُسي مع التعامل الصحيح مع التفاف 0/360
function smoothAngle(prev: number, next: number, alpha = 0.15): number {
  let diff = next - prev;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  let result = prev + diff * alpha;
  if (result < 0) result += 360;
  if (result >= 360) result -= 360;
  return result;
}

export function QiblaCompass() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [qiblaBearing, setQiblaBearing] = useState(0);
  const [heading, setHeading] = useState<number | null>(null);
  const [permError, setPermError] = useState<string | null>(null);
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [isAbsolute, setIsAbsolute] = useState(false);
  const smoothedRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUserCoords().then((c) => {
      setCoords(c);
      setQiblaBearing(calculateQiblaDirection(c.lat, c.lng));
    });
  }, []);

  useEffect(() => {
    let absoluteHandlerAdded = false;
    let relativeHandlerAdded = false;

    function applyHeading(rawHeading: number) {
      // تنعيم
      if (smoothedRef.current == null) {
        smoothedRef.current = rawHeading;
      } else {
        smoothedRef.current = smoothAngle(smoothedRef.current, rawHeading, 0.18);
      }
      // تحديث على معدل العرض (دون إغراق React)
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (smoothedRef.current != null) setHeading(smoothedRef.current);
      });
    }

    function handleAbsolute(e: DeviceOrientationEvent) {
      const anyE = e as any;
      // iOS: webkitCompassHeading يعطي اتجاه البوصلة الحقيقي مباشرة
      if (typeof anyE.webkitCompassHeading === "number") {
        setIsAbsolute(true);
        const acc = anyE.webkitCompassAccuracy;
        if (typeof acc === "number" && acc < 0) setNeedsCalibration(true);
        else setNeedsCalibration(false);
        applyHeading(anyE.webkitCompassHeading);
        return;
      }
      // Android: deviceorientationabsolute → alpha هي زاوية الشمال
      // الاتجاه الحقيقي = 360 - alpha (لأن alpha تدور عكس عقارب الساعة)
      if (e.absolute && typeof e.alpha === "number") {
        setIsAbsolute(true);
        const h = (360 - e.alpha) % 360;
        applyHeading(h);
      }
    }

    function handleRelative(e: DeviceOrientationEvent) {
      // إذا كنا قد حصلنا بالفعل على قيمة absolute، تجاهل النسبية
      if (isAbsolute) return;
      const anyE = e as any;
      if (typeof anyE.webkitCompassHeading === "number") {
        applyHeading(anyE.webkitCompassHeading);
        setIsAbsolute(true);
        return;
      }
      if (typeof e.alpha === "number") {
        // alpha هنا نسبية — قد تنحرف بمرور الوقت، لكن أفضل من لا شيء
        const h = (360 - e.alpha) % 360;
        applyHeading(h);
      }
    }

    async function setup() {
      const anyDOE = (window as any).DeviceOrientationEvent;
      if (anyDOE?.requestPermission) {
        try {
          const p = await anyDOE.requestPermission();
          if (p !== "granted") {
            setPermError("يلزم السماح ببيانات الاتجاه من إعدادات Safari/iOS");
            return;
          }
        } catch {
          setPermError("تعذّر تشغيل البوصلة على هذا الجهاز");
          return;
        }
      }
      // فضّل deviceorientationabsolute (دقة بوصلة حقيقية)
      if ("ondeviceorientationabsolute" in window) {
        window.addEventListener("deviceorientationabsolute", handleAbsolute as any, true);
        absoluteHandlerAdded = true;
      }
      // احتياط: deviceorientation (يحتوي webkitCompassHeading على iOS)
      window.addEventListener("deviceorientation", handleRelative, true);
      relativeHandlerAdded = true;
    }
    setup();
    return () => {
      if (absoluteHandlerAdded)
        window.removeEventListener("deviceorientationabsolute", handleAbsolute as any, true);
      if (relativeHandlerAdded)
        window.removeEventListener("deviceorientation", handleRelative, true);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // الزاوية المراد تدوير سهم القبلة بها (نسبة لاتجاه الجهاز)
  const rotation = heading != null ? qiblaBearing - heading : qiblaBearing;
  // محاذاة عند فرق < 5 درجات (بدلاً من 5 درجات على الجانبين فقط)
  const diff = heading != null ? Math.abs(((qiblaBearing - heading + 540) % 360) - 180) : 999;
  const aligned = heading != null && diff < 5;
  const close = heading != null && diff < 15 && diff >= 5;

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        ref={containerRef}
        className="relative flex h-72 w-72 items-center justify-center rounded-full transition-all"
        style={{
          background: "var(--gradient-card)",
          boxShadow: aligned
            ? "var(--shadow-gold), 0 0 60px color-mix(in oklab, var(--gold) 40%, transparent)"
            : "var(--shadow-elegant)",
          border: "2px solid var(--border)",
        }}
      >
        {/* Cardinal markers — تدور مع اتجاه الجهاز */}
        <div
          className="absolute inset-0 transition-transform"
          style={{
            transform: heading != null ? `rotate(${-heading}deg)` : "rotate(0deg)",
            transitionDuration: "120ms",
          }}
        >
          <div
            className="absolute inset-3 rounded-full border-2 border-dashed"
            style={{ borderColor: "color-mix(in oklab, var(--gold) 40%, transparent)" }}
          />
          {[
            { label: "ش", pos: "top" },
            { label: "ج", pos: "bottom" },
            { label: "شرق", pos: "right" },
            { label: "غرب", pos: "left" },
          ].map((d) => (
            <div
              key={d.label}
              className="absolute text-[11px] font-bold"
              style={{
                color: d.pos === "top" ? "var(--destructive)" : "var(--muted-foreground)",
                top: d.pos === "top" ? "10px" : d.pos === "bottom" ? "auto" : "50%",
                bottom: d.pos === "bottom" ? "10px" : "auto",
                left: d.pos === "left" ? "10px" : d.pos === "right" ? "auto" : "50%",
                right: d.pos === "right" ? "10px" : "auto",
                transform:
                  d.pos === "top" || d.pos === "bottom" ? "translateX(-50%)" : "translateY(-50%)",
              }}
            >
              {d.label}
            </div>
          ))}
        </div>

        {/* سهم القبلة — يدور حسب فرق الزاوية */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionProperty: "transform",
            transitionDuration: "180ms",
            transitionTimingFunction: "ease-out",
          }}
        >
          <div className="relative flex h-full w-full items-center justify-center">
            <div
              className="absolute top-6 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{
                background: "var(--gradient-gold)",
                boxShadow: "var(--shadow-gold)",
              }}
            >
              🕋
            </div>
            <div
              className="absolute top-24 h-32 w-1 rounded-full"
              style={{ background: "linear-gradient(to bottom, var(--gold), transparent)" }}
            />
          </div>
        </div>

        {/* المركز */}
        <div className="z-10 flex flex-col items-center text-center">
          <CompassIcon
            className="h-8 w-8"
            style={{ color: aligned ? "var(--gold)" : close ? "var(--primary)" : "var(--primary)" }}
          />
          <p className="mt-1 text-xs font-bold text-foreground">{Math.round(qiblaBearing)}°</p>
          {heading != null && (
            <p className="text-[10px] text-muted-foreground">جهازك: {Math.round(heading)}°</p>
          )}
        </div>
      </div>

      {aligned && (
        <p
          className="rounded-full px-4 py-1.5 text-sm font-bold animate-pulse-glow"
          style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
        >
          ✦ أنت متجه نحو القبلة ✦
        </p>
      )}
      {close && !aligned && (
        <p className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
          اقترب… استدر قليلاً ({Math.round(diff)}°)
        </p>
      )}

      {needsCalibration && (
        <div className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-[11px] font-bold text-destructive">
          <RefreshCw className="h-3 w-3" />
          البوصلة بحاجة لمعايرة — حرّك جوالك على شكل ∞
        </div>
      )}

      {!isAbsolute && heading != null && (
        <p className="rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
          ⚠️ بوصلة نسبية — قد تنحرف. عاير الجوال (حركة ∞)
        </p>
      )}

      {coords && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          المسافة إلى الكعبة: {Math.round(distanceToKaabaKm(coords.lat, coords.lng))} كم
        </div>
      )}

      {!heading && !permError && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          وجّه الجوال أفقياً وحرّكه على شكل ∞ للمعايرة...
        </div>
      )}
      {permError && <p className="text-xs text-destructive">{permError}</p>}
    </div>
  );
}
