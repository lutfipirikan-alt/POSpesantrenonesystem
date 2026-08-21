/* ===== Design system: komponen reusable ===== */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx, initials } from '../lib/util';
import { IcChevL, IcChevR, IcSearch, IcX, IcCheck, IcAlert, IcInfo } from './icons';

/* ---------- Toast ---------- */
export type ToastKind = 'ok' | 'err' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  desc?: string;
}
const ToastCtx = createContext<{ push: (kind: ToastKind, title: string, desc?: string) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

let toastSeq = 0;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (kind: ToastKind, title: string, desc?: string) => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-3), { id, kind, title, desc }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 left-4 z-[90] flex w-[min(360px,90vw)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'anim-toast pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-surface px-3.5 py-3 shadow-lg',
              t.kind === 'ok' && 'border-okln',
              t.kind === 'err' && 'border-dangerln',
              t.kind === 'info' && 'border-infoln'
            )}
          >
            <span
              className={cx(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-surface',
                t.kind === 'ok' && 'bg-ok',
                t.kind === 'err' && 'bg-danger',
                t.kind === 'info' && 'bg-info'
              )}
            >
              {t.kind === 'ok' ? <IcCheck size={12} /> : t.kind === 'err' ? <IcX size={12} /> : <IcInfo size={12} />}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-snug">{t.title}</div>
              {t.desc && <div className="mt-0.5 whitespace-pre-line text-xs leading-snug text-mute">{t.desc}</div>}
            </div>
            <button className="ml-auto text-mute hover:text-ink" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <IcX size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger' | 'ok' | 'dark';
export function Btn({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-bold transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-[13px]',
        size === 'lg' && 'px-5 py-2.5 text-sm',
        variant === 'primary' && 'bg-navy-800 text-navy-50 shadow-sm hover:bg-navy-700',
        variant === 'gold' && 'bg-gold-400 text-navy-950 shadow-sm hover:bg-gold-300',
        variant === 'dark' && 'bg-navy-950 text-gold-200 hover:bg-navy-900',
        variant === 'outline' && 'border border-line bg-surface text-ink hover:border-navy-300 hover:bg-navy-50',
        variant === 'ghost' && 'text-mute hover:bg-navy-50 hover:text-ink',
        variant === 'danger' && 'bg-danger text-white hover:bg-[#a93c3c]',
        variant === 'ok' && 'bg-ok text-white hover:bg-[#116a49]',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
export type Tone = 'navy' | 'gold' | 'ok' | 'warn' | 'danger' | 'info' | 'mute';
const toneCls: Record<Tone, string> = {
  navy: 'bg-navy-100 text-navy-800 border-navy-200',
  gold: 'bg-gold-50 text-gold-700 border-gold-200',
  ok: 'bg-okbg text-ok border-okln',
  warn: 'bg-warnbg text-warn border-warnln',
  danger: 'bg-dangerbg text-danger border-dangerln',
  info: 'bg-infobg text-info border-infoln',
  mute: 'bg-bg text-mute border-line',
};
export function Badge({ tone = 'mute', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold', toneCls[tone], className)}>
      {children}
    </span>
  );
}

export function statusTone(s: string): Tone {
  const map: Record<string, Tone> = {
    aktif: 'ok', ACTIVE: 'ok', SUCCESS: 'ok', PAID: 'ok', HADIR: 'ok', SELESAI: 'ok', KEMBALI: 'ok', COMPLETED: 'ok', Mumtaz: 'ok',
    cuti: 'warn', PARTIAL: 'warn', TERLAMBAT: 'warn', WASHING: 'warn', DRYING: 'warn', IRONING: 'warn', RECEIVED: 'info', DIPINJAM: 'info', READY: 'info', DITINDAK: 'warn', TERCATAT: 'warn', 'Jayyid Jiddan': 'info', Jayyid: 'info',
    lulus: 'info', keluar: 'danger', nonaktif: 'mute', INACTIVE: 'mute', CANCELLED: 'danger', Maqbul: 'danger',
    BLOCKED: 'danger', LOST: 'danger', UNPAID: 'danger', REFUNDED: 'warn', REPLACED: 'mute',
  };
  return map[s] ?? 'mute';
}

/* ---------- Card / Stat ---------- */
export function Card({ title, sub, action, children, className, pad = true }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,29,51,0.05)]', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h3 className="font-display text-[15px] font-bold tracking-tight">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-mute">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, icon, tone = 'navy', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: Tone; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        'group flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-[0_1px_2px_rgba(16,29,51,0.05)] transition-all',
        onClick && 'hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-md'
      )}
    >
      {icon && (
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', toneCls[tone])}>{icon}</span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-mute">{label}</span>
        <span className="font-display mt-1 block text-xl font-bold leading-none tracking-tight tnum">{value}</span>
        {sub && <span className="mt-1.5 block text-[11px] text-mute">{sub}</span>}
      </span>
    </button>
  );
}

/* ---------- Form ---------- */
export function Field({ label, children, hint, req }: { label: string; children: ReactNode; hint?: string; req?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-ink">
        {label} {req && <span className="text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-mute">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-mute/60 focus:border-navy-400 focus:ring-2 focus:ring-navy-100 disabled:opacity-50';

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <IcSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
      <input className={cx(inputCls, 'pl-9')} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Cari…'} />
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center gap-2 text-xs font-bold text-mute">
      <span className={cx('relative h-5 w-9 rounded-full transition-colors', on ? 'bg-ok' : 'bg-line')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all', on ? 'left-4.5' : 'left-0.5')} style={{ left: on ? 18 : 2 }} />
      </span>
      {label}
    </button>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, w = 'max-w-lg', footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; w?: string; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-950/55 p-3 backdrop-blur-[2px] sm:items-center" onMouseDown={onClose}>
      <div className={cx('anim-pop max-h-[92vh] w-full overflow-auto rounded-xl border border-line bg-surface shadow-2xl', w)} onMouseDown={(e) => e.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h3 className="font-display text-[15px] font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-mute hover:bg-bg hover:text-ink">
            <IcX size={16} />
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, active, onChange }: { tabs: Array<{ key: string; label: ReactNode }>; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-bg p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            'rounded-md px-3 py-1.5 text-xs font-bold transition-all',
            active === t.key ? 'bg-navy-800 text-navy-50 shadow-sm' : 'text-mute hover:bg-surface hover:text-ink'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, pages, onPage, total, shown }: { page: number; pages: number; onPage: (p: number) => void; total: number; shown: number }) {
  if (pages <= 1) return <div className="text-[11px] text-mute">{total} baris</div>;
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-mute">
      <span>
        {shown} dari {total} baris
      </span>
      <div className="flex items-center gap-1">
        <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <IcChevL size={13} />
        </Btn>
        <span className="px-1 font-bold text-ink tnum">
          {page}/{pages}
        </span>
        <Btn variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <IcChevR size={13} />
        </Btn>
      </div>
    </div>
  );
}

/* ---------- Empty / Avatar / KV ---------- */
export function Empty({ title, desc, action, icon }: { title: string; desc?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-line text-mute">{icon ?? <IcInfo size={22} />}</span>
      <p className="text-sm font-bold">{title}</p>
      {desc && <p className="max-w-sm text-xs text-mute">{desc}</p>}
      {action}
    </div>
  );
}

export function Avatar({ name, color = '#1f4b85', size = 36 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="font-display flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[13px]">
      <span className="text-mute">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}

/* ---------- Tabel ---------- */
export function THead({ cols }: { cols: Array<string | ReactNode> }) {
  return (
    <thead>
      <tr className="border-b border-line text-left">
        {cols.map((c, i) => (
          <th key={i} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-mute">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}
export function TWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}
export function TRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={cx('border-b border-line/70 transition-colors last:border-0', onClick && 'cursor-pointer hover:bg-navy-50/60')}>
      {children}
    </tr>
  );
}
export function TD({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <td className={cx('px-3 py-2.5 align-middle', right && 'text-right', className)}>{children}</td>;
}

/* ---------- Penerima scan NFC (dipakai banyak halaman) ---------- */
export function useNfcScan(handler: (uid: string) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h = (e: Event) => {
      const uid = (e as CustomEvent<{ uid: string }>).detail?.uid;
      if (uid) ref.current(uid);
    };
    window.addEventListener('pos1s:nfc', h);
    return () => window.removeEventListener('pos1s:nfc', h);
  }, []);
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
