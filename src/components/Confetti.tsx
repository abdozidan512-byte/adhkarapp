import { useEffect, useState } from "react";

type Piece = { id: number; left: number; delay: number; color: string; rot: number; size: number };

const COLORS = ["#FFD93D", "#FF6B6B", "#6BCB77", "#4D96FF", "#C780FA", "#FFA94D"];

export function Confetti({ trigger, count = 60 }: { trigger: number; count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const arr: Piece[] = Array.from({ length: count }).map((_, i) => ({
      id: trigger * 1000 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * 360,
      size: 6 + Math.random() * 8,
    }));
    setPieces(arr);
    const t = setTimeout(() => setPieces([]), 2500);
    return () => clearTimeout(t);
  }, [trigger, count]);

  if (!pieces.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size * 0.4,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
      <style>{`
        .confetti-piece {
          position: absolute;
          top: -10px;
          border-radius: 2px;
          animation: confetti-fall 2.2s cubic-bezier(.2,.7,.4,1) forwards;
          will-change: transform, opacity;
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
