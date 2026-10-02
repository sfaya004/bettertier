/**
 * A small single-series bar chart rendered as inline SVG (no client JS).
 * One measure per chart – never two axes. Bars are thin, anchored to the
 * baseline with a rounded top, with a 2px gap between them. Hovering a bar
 * shows its value (native tooltip); a table version is provided by the caller.
 */
export function DailyBars({ points, label, id }: { points: { day: string; value: number }[]; label: string; id: string }) {
  const width = 640;
  const height = 160;
  const padL = 36;
  const padR = 8;
  const padT = 16;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...points.map((p) => p.value));
  const niceMax = niceCeil(max);
  const n = points.length;
  const slot = innerW / n;
  const gap = n > 40 ? 1 : 2;
  const barW = Math.max(2, slot - gap);
  const y = (v: number) => padT + innerH - (v / niceMax) * innerH;
  const ticks = [0, niceMax / 2, niceMax];
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const labelEvery = n <= 7 ? 1 : n <= 30 ? 7 : 15;

  return (
    <figure className="m-0">
      <figcaption className="text-[0.95rem] font-semibold">{label}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title`} className="mt-1 w-full h-auto">
        <title id={`${id}-title`}>
          {label}: {points.map((p) => `${p.day} ${p.value}`).join(", ")}
        </title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-soft)">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = padL + i * slot + gap / 2;
          const h = p.value === 0 ? 0 : Math.max(2, (p.value / niceMax) * innerH);
          const top = padT + innerH - h;
          const r = Math.min(4, barW / 2, h);
          const d = h === 0 ? "" : `M${x},${padT + innerH} V${top + r} a${r},${r} 0 0 1 ${r},-${r} H${x + barW - r} a${r},${r} 0 0 1 ${r},${r} V${padT + innerH} Z`;
          const showLabel = i % labelEvery === 0 || i === n - 1;
          return (
            <g key={p.day}>
              <title>{`${friendlyDay(p.day)}: ${p.value.toLocaleString("en-US")}`}</title>
              {/* hit target wider than the bar */}
              <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" />
              {d ? <path d={d} fill="var(--color-brand)" /> : null}
              {i === peak && p.value > 0 ? (
                <text x={x + barW / 2} y={top - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-ink)">
                  {p.value.toLocaleString("en-US")}
                </text>
              ) : null}
              {showLabel ? (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--color-ink-soft)">
                  {shortDay(p.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function niceCeil(v: number): number {
  if (v <= 10) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const step = norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function formatTick(v: number): string {
  return v >= 1000 ? `${v / 1000}k` : String(v);
}

function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function friendlyDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
