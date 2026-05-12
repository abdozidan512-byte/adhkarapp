import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  getMissionsList,
  getMissionsState,
  incrementDailyDhikr,
  onMissionsChanged,
  type Mission,
  type MissionsState,
  getTodaysDailyDhikr,
} from "@/lib/achievements";

export const Route = createFileRoute("/missions")({
  component: MissionsPage,
  head: () => ({
    meta: [
      { title: "المهام اليومية — نور" },
      { name: "description", content: "مهام يومية متجددة: أذكار، قرآن، تسبيح وذكر اليوم." },
    ],
  }),
});

function MissionsPage() {
  const [state, setState] = useState<MissionsState | null>(null);
  const list = getMissionsList();

  const refresh = () => getMissionsState().then(setState);

  useEffect(() => {
    refresh();
    const off = onMissionsChanged(refresh);
    return off;
  }, []);

  const doneCount = list.filter((m) => state?.done[m.id]).length;
  const allDone = doneCount === list.length;

  return (
    <div style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
      <PageHeader title="المهام اليومية" subtitle="تتجدد كل يوم — أكملها كلها لتحصد المكافأة" />

      <div className="space-y-3 px-4 py-4">
        {/* Progress */}
        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">
              {allDone ? "بارك الله فيك! اكتملت مهام اليوم" : "تقدّم اليوم"}
            </p>
            <p className="text-xs text-muted-foreground">{doneCount} / {list.length}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full transition-all"
              style={{
                width: `${(doneCount / list.length) * 100}%`,
                background: allDone ? "var(--gradient-gold)" : "var(--gradient-primary)",
              }}
            />
          </div>
        </div>

        {/* Missions */}
        <div className="space-y-2">
          {list.map((m) => (
            <MissionCard key={m.id} mission={m} state={state} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MissionCard({ mission, state }: { mission: Mission; state: MissionsState | null }) {
  const done = !!state?.done[mission.id];
  const linkTo = mission.id === "morning"
    ? "/azkar/morning"
    : mission.id === "evening"
    ? "/azkar/evening"
    : mission.id === "quran"
    ? "/quran"
    : mission.id === "tasbih"
    ? "/tasbih"
    : null;

  const body = (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3 transition-all"
      style={{
        background: done ? "color-mix(in oklab, var(--gold) 14%, var(--card))" : "var(--card)",
        borderColor: done ? "var(--gold)" : "var(--border)",
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
        style={{
          background: done ? "var(--gradient-gold)" : "color-mix(in oklab, var(--primary) 10%, transparent)",
          color: done ? "var(--gold-foreground)" : undefined,
          boxShadow: done ? "var(--shadow-gold)" : undefined,
        }}
      >
        {mission.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold truncate">{mission.title}</p>
        <p className="text-xs text-muted-foreground truncate">{mission.description}</p>
        {mission.id === "tasbih" && state && !done && (
          <p className="mt-0.5 text-[10px] font-bold tabular-nums" style={{ color: "var(--primary)" }}>
            {state.tasbihToday} / 100
          </p>
        )}
        {mission.id === "daily" && state && !done && (
          <p className="mt-0.5 text-[10px] font-bold tabular-nums" style={{ color: "var(--primary)" }}>
            {state.dailyDhikrCount} / 33
          </p>
        )}
      </div>
      {done ? (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}
        >
          <Check className="h-5 w-5" />
        </div>
      ) : mission.id === "daily" ? (
        <button
          onClick={(e) => { e.preventDefault(); incrementDailyDhikr(); }}
          className="flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold"
          style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="h-3 w-3" /> ذكر
        </button>
      ) : (
        <span className="text-[10px] font-bold text-muted-foreground">ابدأ ←</span>
      )}
    </div>
  );

  if (linkTo) return <Link to={linkTo}>{body}</Link>;
  return body;
}
