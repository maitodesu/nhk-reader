import type { PitchPattern } from "@/lib/types";

const STEP = 22;
const PAD = 10;
const HIGH_Y = 7;
const LOW_Y = 21;
const R = 3;

function accentLabel(accent: number, moraCount: number): string {
  if (accent === 0) return "平板";
  if (accent === 1) return "頭高";
  if (accent === moraCount) return "尾高";
  return "中高";
}

export function PitchAccentGraph({ pattern }: { pattern: PitchPattern }) {
  const { moras, pitches, accent } = pattern;
  const width = PAD * 2 + STEP * (moras.length - 1) + (accent === moras.length ? STEP * 0.6 : 0);
  const points = pitches.map((p, i) => ({
    x: PAD + i * STEP,
    y: p === "H" ? HIGH_Y : LOW_Y,
  }));
  const isOdaka = accent !== 0 && accent === moras.length;

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={28} className="shrink-0 overflow-visible">
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--shu)"
          strokeWidth={1.5}
        />
        {isOdaka && (
          <line
            x1={points[points.length - 1].x}
            y1={HIGH_Y}
            x2={points[points.length - 1].x + STEP * 0.6}
            y2={LOW_Y}
            stroke="var(--shu)"
            strokeWidth={1.5}
            strokeDasharray="2,2"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={R}
            fill={pitches[i] === "H" ? "var(--shu)" : "var(--card)"}
            stroke="var(--shu)"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <span className="text-[11px] whitespace-nowrap text-sumi-soft">
        [{accent}] {accentLabel(accent, moras.length)}
      </span>
    </div>
  );
}
