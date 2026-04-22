import { useEffect, useRef, useState } from "react";
import { Compass as CompassIcon, MapPin, Loader2 } from "lucide-react";
import { calculateQiblaDirection, distanceToKaabaKm } from "@/lib/qibla";
import { getUserCoords } from "@/lib/prayer";

export function QiblaCompass() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [qiblaBearing, setQiblaBearing] = useState(0);
  const [heading, setHeading] = useState<number | null>(null);
  const [permError, setPermError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUserCoords().then((c) => {
      setCoords(c);
      setQiblaBearing(calculateQiblaDirection(c.lat, c.lng));
    });
  }, []);

  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      // iOS provides webkitCompassHeading; Android uses alpha (0-360 from north)
      const anyE = e as any;
      const h = anyE.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      if (h != null) setHeading(h);
    }

    async function setup() {
      const anyDOE = (window as any).DeviceOrientationEvent;
      if (anyDOE?.requestPermission) {
        try {
          const p = await anyDOE.requestPermission();
          if (p !== "granted") {
            setPermError("يلزم السماح ببيانات الاتجاه");
            return;
          }
        } catch {
          setPermError("تعذّر تشغيل البوصلة");
          return;
        }
      }
      window.addEventListener("deviceorientationabsolute", handleOrientation as any, true);
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
    setup();
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation as any, true);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  const rotation = heading != null ? qiblaBearing - heading : qiblaBearing;
  const aligned = heading != null && Math.abs(((rotation + 540) % 360) - 180) > 175;

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        ref={containerRef}
        className="relative flex h-72 w-72 items-center justify-center rounded-full transition-all"
        style={{
          background: "var(--gradient-card)",
          boxShadow: aligned ? "var(--shadow-gold), 0 0 60px color-mix(in oklab, var(--gold) 40%, transparent)" : "var(--shadow-elegant)",
          border: "2px solid var(--border)",
        }}
      >
        {/* Cardinal markers */}
        <div className="absolute inset-3 rounded-full border-2 border-dashed" style={{ borderColor: "color-mix(in oklab, var(--gold) 40%, transparent)" }} />
        {["N", "E", "S", "W"].map((dir, i) => (
          <div
            key={dir}
            className="absolute font-bold text-muted-foreground"
            style={{
              top: i === 0 ? "12px" : i === 2 ? "auto" : "50%",
              bottom: i === 2 ? "12px" : "auto",
              right: i === 1 ? "auto" : i === 3 ? "12px" : "50%",
              left: i === 1 ? "12px" : "auto",
              transform: i === 0 || i === 2 ? "translateX(50%)" : "translateY(-50%)",
            }}
          >
            {dir === "N" ? "ش" : dir === "S" ? "ج" : dir === "E" ? "ش" : "غ"}
          </div>
        ))}

        {/* Rotating qibla arrow */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
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

        <div className="z-10 flex flex-col items-center text-center">
          <CompassIcon className="h-8 w-8 text-primary" />
          <p className="mt-1 text-xs font-bold text-foreground">
            {Math.round(qiblaBearing)}°
          </p>
        </div>
      </div>

      {aligned && (
        <p className="rounded-full px-4 py-1.5 text-sm font-bold animate-pulse-glow" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}>
          ✦ أنت متجه نحو القبلة ✦
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
          وجّه الجوال أفقياً للحصول على البوصلة...
        </div>
      )}
      {permError && <p className="text-xs text-destructive">{permError}</p>}
    </div>
  );
}
