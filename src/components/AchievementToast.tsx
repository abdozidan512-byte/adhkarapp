import { useEffect, useRef, useState } from "react";
import { onAchievementUnlocked, type Achievement } from "@/lib/achievements";
import { Confetti } from "./Confetti";

export function AchievementToast() {
  const [current, setCurrent] = useState<Achievement | null>(null);
  const [trigger, setTrigger] = useState(0);
  const queue = useRef<Achievement[]>([]);
  const showing = useRef(false);

  useEffect(() => {
    const showNext = () => {
      const next = queue.current.shift();
      if (!next) {
        showing.current = false;
        return;
      }
      showing.current = true;
      setCurrent(next);
      setTrigger((t) => t + 1);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([30, 40, 60]);
      }
      setTimeout(() => {
        setCurrent(null);
        setTimeout(showNext, 300);
      }, 3500);
    };

    return onAchievementUnlocked((a) => {
      queue.current.push(a);
      if (!showing.current) showNext();
    });
  }, []);

  return (
    <>
      <Confetti trigger={trigger} />
      {current && (
        <div
          className="fixed left-1/2 top-6 z-[201] w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border p-4 shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300"
          style={{
            background: "var(--gradient-gold)",
            color: "var(--gold-foreground)",
            boxShadow: "var(--shadow-gold)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/30 text-2xl">
              {current.icon}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold tracking-widest opacity-80">إنجاز جديد</p>
              <p className="text-base font-extrabold">{current.title}</p>
              <p className="text-xs opacity-90">{current.description}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
