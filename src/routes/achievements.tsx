import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ACHIEVEMENTS, getStats, type Stats } from "@/lib/achievements";

export const Route = createFileRoute("/achievements")({
  component: AchievementsPage,
  head: () => ({
    meta: [{ title: "الإنجازات — نور" }],
  }),
});

function AchievementsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  const unlocked = stats?.unlocked ?? [];
  const total = ACHIEVEMENTS.length;

  return (
    <div style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
      <PageHeader title="الإنجازات" subtitle="مكافآت رحلتك مع الذكر والقرآن" />

      <div className="space-y-3 px-4 py-4">
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="التسبيحات" value={stats?.totalTasbih ?? 0} />
          <StatCard label="السور" value={stats?.completedSurahs ?? 0} />
          <StatCard label="أيام متتالية" value={stats?.azkarStreak ?? 0} />
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">التقدم</p>
            <p className="text-xs text-muted-foreground">
              {unlocked.length} / {total}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full transition-all"
              style={{
                width: `${(unlocked.length / total) * 100}%`,
                background: "var(--gradient-gold)",
              }}
            />
          </div>
        </div>

        {/* Achievements list */}
        <div className="space-y-2 pt-2">
          {ACHIEVEMENTS.map((a) => {
            const got = unlocked.includes(a.id);
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border p-3"
                style={{
                  background: got ? "var(--gradient-card)" : "var(--card)",
                  opacity: got ? 1 : 0.55,
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                  style={{
                    background: got ? "var(--gradient-gold)" : "var(--muted)",
                    color: got ? "var(--gold-foreground)" : undefined,
                    boxShadow: got ? "var(--shadow-gold)" : undefined,
                    filter: got ? undefined : "grayscale(1)",
                  }}
                >
                  {a.icon}
                </div>
                <div className="flex-1">
                  <p className="font-extrabold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
                {got && <span className="text-xs font-bold" style={{ color: "var(--gold)" }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-2xl border p-3 text-center"
      style={{ background: "var(--card)" }}
    >
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}
