/* ===== Grafik SVG ringan tanpa dependensi ===== */

import { useState } from 'react';
import { num } from '../lib/util';

export function AreaChart({
  data,
  labels,
  height = 190,
  color = '#1f4b85',
  format = (n: number) => num(n),
}: {
  data: number[];
  labels: string[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const padL = 8;
  const padB = 20;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [
    padL + (i / Math.max(1, data.length - 1)) * (W - padL * 2),
    H - padB - (v / max) * (H - padB - 14),
  ]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1]![0].toFixed(1)},${H - padB} L${pts[0]![0].toFixed(1)},${H - padB} Z`;
  const gid = `ag-${color.replace('#', '')}`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bd = Infinity;
          pts.forEach((p, i) => {
            const d = Math.abs(p[0] - x);
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padL} x2={W - padL} y1={H - padB - f * (H - padB - 14)} y2={H - padB - f * (H - padB - 14)} stroke="#e2e8f1" strokeWidth="1" strokeDasharray="3 5" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" className="dash-flow" style={{ strokeDasharray: 'none' }} />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 5 : 2.6} fill={hover === i ? color : '#fbfcfe'} stroke={color} strokeWidth="2" />
        ))}
        {labels.map((l, i) =>
          i % Math.ceil(labels.length / 8) === 0 ? (
            <text key={i} x={pts[i]![0]} y={H - 5} textAnchor="middle" fontSize="10.5" fill="#5c6c86">
              {l}
            </text>
          ) : null
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold shadow-md"
          style={{ left: `${(pts[hover]![0] / W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <span className="text-mute">{labels[hover]} · </span>
          <span className="tnum text-ink">{format(data[hover]!)}</span>
        </div>
      )}
    </div>
  );
}

export function Bars({
  data,
  color = '#dba63e',
  format = (n: number) => num(n),
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-bold shadow-md tnum">
                {format(d.value)}
              </div>
            )}
            <div
              className="bar-grow w-full rounded-t-[5px] transition-all duration-200"
              style={{ height: `${Math.max(3, (d.value / max) * 100)}%`, background: hover === i ? color : `${color}cc`, animationDelay: `${i * 45}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10.5px] text-mute">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Donut({
  slices,
  size = 150,
  thickness = 20,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
}) {
  const total = Math.max(
    slices.reduce((a, s) => a + s.value, 0),
    1
  );
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f1" strokeWidth={thickness} />
        {slices.map((s, i) => {
          const frac = s.value / total;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${frac * C} ${C}`}
              strokeDashoffset={-acc * C}
              strokeLinecap={frac > 0.02 ? 'butt' : 'round'}
              className="transition-all duration-700"
            />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-mute">{s.label}</span>
            <span className="font-bold tnum">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Spark({ data, color = '#17835a', w = 96, h = 30 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - 3 - ((v - min) / range) * (h - 6)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
