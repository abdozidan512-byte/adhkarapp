import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, RotateCcw, Trash2, Check, Vibrate, Trophy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { getSetting, saveSetting } from "@/lib/db";
import { recordTasbih } from "@/lib/achievements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Dhikr = {
  id: string;
  text: string;
  target: number;
  count: number;
};

const DEFAULTS: Dhikr[] = [
  { id: "subhan", text: "سبحان الله", target: 33, count: 0 },
  { id: "hamd", text: "الحمد لله", target: 33, count: 0 },
  { id: "akbar", text: "الله أكبر", target: 34, count: 0 },
  { id: "istighfar", text: "أستغفر الله", target: 100, count: 0 },
  { id: "lailaha", text: "لا إله إلا الله", target: 100, count: 0 },
];

export const Route = createFileRoute("/tasbih")({
  component: TasbihPage,
  head: () => ({
    meta: [
      { title: "المسبحة — نور" },
      { name: "description", content: "مسبحة إلكترونية للتسبيح وإضافة أذكار مخصصة." },
    ],
  }),
});

function TasbihPage() {
  const [items, setItems] = useState<Dhikr[]>(DEFAULTS);
  const [activeId, setActiveId] = useState<string>("subhan");
  const [vibrate, setVibrate] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Add dialog
  const [open, setOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTarget, setNewTarget] = useState(33);

  useEffect(() => {
    (async () => {
      const saved = await getSetting<Dhikr[]>("tasbih-items");
      const savedActive = await getSetting<string>("tasbih-active");
      const savedVibrate = await getSetting<boolean>("tasbih-vibrate");
      if (saved && saved.length) setItems(saved);
      if (savedActive) setActiveId(savedActive);
      if (typeof savedVibrate === "boolean") setVibrate(savedVibrate);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) saveSetting("tasbih-items", items);
  }, [items, loaded]);
  useEffect(() => {
    if (loaded) saveSetting("tasbih-active", activeId);
  }, [activeId, loaded]);
  useEffect(() => {
    if (loaded) saveSetting("tasbih-vibrate", vibrate);
  }, [vibrate, loaded]);

  const active = items.find((i) => i.id === activeId) ?? items[0];
  if (!active) return null;

  const progress = Math.min(100, (active.count / active.target) * 100);
  const completed = active.count >= active.target;

  const tap = () => {
    if (vibrate && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(completed ? [40, 30, 80] : 15);
    }
    setItems((prev) =>
      prev.map((i) => (i.id === activeId ? { ...i, count: i.count + 1 } : i))
    );
  };

  const reset = () => {
    setItems((prev) => prev.map((i) => (i.id === activeId ? { ...i, count: 0 } : i)));
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (id === activeId && next.length) setActiveId(next[0].id);
      return next;
    });
  };

  const addDhikr = () => {
    const text = newText.trim();
    if (!text) return;
    const id = `c-${Date.now()}`;
    const item: Dhikr = { id, text, target: Math.max(1, Number(newTarget) || 33), count: 0 };
    setItems((prev) => [...prev, item]);
    setActiveId(id);
    setNewText("");
    setNewTarget(33);
    setOpen(false);
  };

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      <PageHeader title="المسبحة" subtitle="سبّح بحمد الله" />

      <div className="px-4 py-4 space-y-4">
        {/* Active dhikr display */}
        <div
          className="relative overflow-hidden rounded-3xl border p-6 text-center"
          style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}
        >
          <p className="text-xs font-bold tracking-widest text-muted-foreground">الذكر الحالي</p>
          <p className="font-quran mt-2 text-3xl font-extrabold leading-loose">{active.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            الهدف: {active.target} مرة
          </p>
        </div>

        {/* Counter button */}
        <button
          onClick={tap}
          className="relative mx-auto flex aspect-square w-full max-w-xs flex-col items-center justify-center rounded-full border-4 transition-transform active:scale-95"
          style={{
            background: "var(--gradient-gold)",
            color: "var(--gold-foreground)",
            boxShadow: "var(--shadow-gold)",
            borderColor: "color-mix(in oklab, var(--gold) 60%, transparent)",
          }}
        >
          <span className="text-7xl font-black tabular-nums">{active.count}</span>
          <span className="mt-2 text-sm font-bold opacity-80">
            / {active.target}
          </span>
          {completed && (
            <span className="absolute top-6 flex items-center gap-1 rounded-full bg-black/15 px-3 py-1 text-xs font-bold">
              <Check className="h-3 w-3" /> اكتمل
            </span>
          )}
        </button>

        {/* Progress */}
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, background: "var(--gold)" }}
          />
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Button onClick={reset} variant="outline" className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" /> تصفير
          </Button>
          <Button
            onClick={() => setVibrate((v) => !v)}
            variant={vibrate ? "default" : "outline"}
            className="gap-2"
            aria-label="اهتزاز"
          >
            <Vibrate className="h-4 w-4" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 gap-2">
                <Plus className="h-4 w-4" /> إضافة ذكر
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة ذكر جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>نص الذكر</Label>
                  <Input
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="مثلاً: لا حول ولا قوة إلا بالله"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>عدد مرات التسبيح (الهدف)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newTarget}
                    onChange={(e) => setNewTarget(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addDhikr} disabled={!newText.trim()}>
                  حفظ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-bold text-muted-foreground">الأذكار</p>
          {items.map((it) => {
            const isActive = it.id === activeId;
            return (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded-2xl border p-3 transition-all"
                style={{
                  background: isActive
                    ? "color-mix(in oklab, var(--primary) 10%, var(--card))"
                    : "var(--card)",
                  borderColor: isActive ? "var(--primary)" : "var(--border)",
                }}
              >
                <button
                  onClick={() => setActiveId(it.id)}
                  className="flex-1 text-right"
                >
                  <p className="font-quran text-lg font-bold">{it.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.count} / {it.target}
                  </p>
                </button>
                <button
                  onClick={() => remove(it.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
