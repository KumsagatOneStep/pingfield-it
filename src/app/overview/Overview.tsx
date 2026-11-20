"use client";
// "Обзор": bento-style dashboard tiles over the registry's own data.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, FileText, Package, Printer, User } from "lucide-react";
import type { OverviewData } from "@/lib/overview/load";
import { timeAgo } from "@/lib/overview/stats";
import { SUBNET_LABEL, SUBNET_PREFIX } from "@/lib/subnet";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setR(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  return r;
}

function useMounted() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function useCountUp(target: number, enabled: boolean, duration = 1100) {
  const [v, setV] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);
  return v;
}

function Tile({ title, action, className, children }: { title?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cx("ov-tile", className)}>
      {(title || action) && (
        <header className="ov-tile-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" });
};

/* ---------- Hero: greeting, free IPs, subnet strip ---------- */
function HeroTile({ d, reduced }: { d: OverviewData; reduced: boolean }) {
  const mounted = useMounted();
  const free = useCountUp(d.subnet.free, !reduced);
  const [hover, setHover] = useState<number | null>(null);
  const cell = hover !== null ? d.subnet.cells[hover] : null;
  return (
    <Tile className="ov-span2">
      <div className="ov-hero">
        <div className="ov-hero-hi">
          <p className="ov-hello">{d.greeting}, <span className="ov-accent-text">{d.name}</span></p>
          <p className="ov-muted">{fmtDay(d.today)}. Вот как дела в сети печати.</p>
        </div>
        <div className="ov-hero-num">
          <p className="ov-muted ov-small">Свободно IP в {SUBNET_LABEL}</p>
          <p className="ov-big mono">{free}</p>
          <p className="ov-small mono">
            <span className="ov-accent-text">занято {d.subnet.busy}</span>
            {d.subnet.dup > 0 && <span className="ov-warn-text"> · дублей {d.subnet.dup}</span>}
            <span className="ov-muted"> · из 254</span>
          </p>
        </div>
      </div>
      {/* Two rows (.1–.127, .128–.254): one row of 254 bars is ~1px each and smears. */}
      {[d.subnet.cells.slice(0, 127), d.subnet.cells.slice(127)].map((row, r) => (
        <div key={r} className={cx("ov-strip", "ov-strip-half", r === 1 && "ov-strip-2")} onPointerLeave={() => setHover(null)}>
          {row.map((c) => {
            const i = c.n - 1;
            return (
              <span
                key={c.n}
                className={cx("ov-bar", `is-${c.state}`)}
                onPointerEnter={() => setHover(i)}
                style={{
                  height: mounted || reduced ? (c.state === "free" ? "22%" : "100%") : "4%",
                  opacity: hover === null ? undefined : hover === i ? 1 : 0.3,
                  transition: reduced ? "none" : `height 800ms ${EASE} ${(i % 127) * 5}ms, opacity 150ms ease`,
                }}
              />
            );
          })}
        </div>
      ))}
      <div className="ov-strip-foot mono">
        <span>верх .1–.127</span>
        <span className="ov-strip-label" aria-live="polite">
          {cell ? `${SUBNET_PREFIX}${cell.n} — ${cell.owners.length ? cell.owners.join(", ") : "свободен"}` : "Карта подсети: наведите на столбик"}
        </span>
        <span>низ .128–.254</span>
      </div>
    </Tile>
  );
}

/* ---------- First free IP: solid accent tile ---------- */
function FirstFreeTile({ d }: { d: OverviewData }) {
  const [copied, setCopied] = useState(false);
  const ip = d.subnet.firstFree;
  return (
    <section className="ov-tile ov-solid">
      <header className="ov-tile-head"><h2>Первый свободный IP</h2></header>
      {ip ? (
        <>
          <p className="ov-solid-num mono">.{ip.split(".").pop()}</p>
          <p className="mono ov-small">{ip}</p>
          <div className="ov-solid-actions">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(ip);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
            >
              {copied ? "Скопировано" : "Скопировать IP"}
            </button>
            <Link href="/registry">Открыть реестр →</Link>
          </div>
        </>
      ) : (
        <p className="ov-small">Свободных адресов в {SUBNET_LABEL} нет.</p>
      )}
    </section>
  );
}

/* ---------- Gauge: subnet fill ---------- */
function GaugeTile({ d, reduced }: { d: OverviewData; reduced: boolean }) {
  const mounted = useMounted();
  const t = d.subnet.busy / 254;
  const shown = mounted || reduced ? t : 0;
  const R = 62;
  const len = Math.PI * R;
  return (
    <Tile title="Заполненность подсети">
      <div className="ov-gauge">
        <svg width="150" height="86" viewBox="0 0 150 86" aria-hidden>
          <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" className="ov-gauge-track" />
          <path
            d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={len}
            className="ov-gauge-fill"
            style={{ strokeDashoffset: len * (1 - shown), transition: reduced ? "none" : `stroke-dashoffset 900ms ${EASE}` }}
          />
          <g style={{ transform: `rotate(${-90 + shown * 180}deg)`, transformOrigin: "75px 78px", transition: reduced ? "none" : `transform 900ms ${EASE}` }}>
            <line x1="75" y1="78" x2="75" y2="30" strokeWidth="2.5" strokeLinecap="round" className="ov-gauge-needle" />
          </g>
          <circle cx="75" cy="78" r="5" className="ov-gauge-hub" />
        </svg>
        <p className="ov-mid mono">{Math.round(t * 100)}<span className="ov-muted ov-small">%</span></p>
      </div>
      <dl className="ov-dl">
        <div><dt>Принтеров в реестре</dt><dd className="mono">{d.printersTotal}</dd></div>
        <div><dt>Вне {SUBNET_LABEL} / без IP</dt><dd className="mono">{d.subnet.outside}</dd></div>
      </dl>
    </Tile>
  );
}

/* ---------- Cartridges ---------- */
function CartridgesTile({ c, reduced }: { c: NonNullable<OverviewData["cartridges"]>; reduced: boolean }) {
  const mounted = useMounted();
  const total = c.waiting.reduce((s, w) => s + w.count, 0);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <Tile title="Картриджи" className="ov-span2" action={<Link className="ov-link" href="/cartridges">Открыть →</Link>}>
      <div className="ov-row">
        <div>
          <p className="ov-muted ov-small">Сейчас у подрядчика</p>
          <p className="ov-mid mono">{c.inContractor}</p>
        </div>
        <div>
          <p className="ov-muted ov-small">Ждут возврата на объекты</p>
          <p className="ov-mid mono">{total}</p>
        </div>
      </div>
      <div className="ov-seg" onPointerLeave={() => setHover(null)}>
        {total === 0 ? (
          <span className="ov-seg-empty">Все картриджи возвращены на объекты</span>
        ) : (
          c.waiting.map((w, i) => (
            <span
              key={w.place}
              className={`ov-seg-part c${i}`}
              onPointerEnter={() => setHover(i)}
              style={{
                flexBasis: mounted || reduced ? `${(w.count / total) * 100}%` : `${100 / c.waiting.length}%`,
                opacity: hover === null || hover === i ? 1 : 0.3,
                transition: reduced ? "none" : `flex-basis 1000ms ${EASE} ${200 + i * 60}ms, opacity 150ms ease`,
              }}
            />
          ))
        )}
      </div>
      <ul className="ov-legend">
        {c.waiting.map((w, i) => (
          <li key={w.place} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span><i className={`ov-dot c${i}`} aria-hidden />{w.place}</span>
            <span className="mono ov-muted">{w.count}</span>
          </li>
        ))}
      </ul>
      {c.topModels.length > 0 && (
        <p className="ov-small ov-muted ov-models">
          Больше всего у подрядчика: {c.topModels.map((m) => `${m.model} — ${m.remaining}`).join(" · ")}
        </p>
      )}
    </Tile>
  );
}

/* ---------- Acts ---------- */
function ActsTile({ a, today, reduced }: { a: NonNullable<OverviewData["acts"]>; today: string; reduced: boolean }) {
  const mounted = useMounted();
  const max = Math.max(1, ...a.daily);
  const [hover, setHover] = useState<number | null>(null);
  const dayLabel = (i: number) => {
    const t = new Date(`${today}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - (a.daily.length - 1 - i));
    return t.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
  };
  return (
    <Tile title="Акты ТМЦ" action={<Link className="ov-link" href="/acts">Открыть →</Link>}>
      <p className="ov-muted ov-small">В этом месяце</p>
      <p className="ov-mid mono">{a.month}</p>
      <div className="ov-strip ov-strip-sm" onPointerLeave={() => setHover(null)}>
        {a.daily.map((n, i) => (
          <span
            key={i}
            className={cx("ov-bar", n > 0 ? "is-busy" : "is-free")}
            onPointerEnter={() => setHover(i)}
            style={{
              height: mounted || reduced ? `${n > 0 ? 25 + (n / max) * 75 : 10}%` : "4%",
              opacity: hover === null ? undefined : hover === i ? 1 : 0.3,
              transition: reduced ? "none" : `height 800ms ${EASE} ${i * 15}ms, opacity 150ms ease`,
            }}
          />
        ))}
      </div>
      <p className="ov-strip-foot mono">
        <span className="ov-strip-label">{hover !== null ? `${dayLabel(hover)}: ${a.daily[hover]}` : "30 дней"}</span>
      </p>
    </Tile>
  );
}

/* ---------- Helper ---------- */
function HelperTile({ h, canEdit, wide }: { h: OverviewData["helper"]; canEdit: boolean; wide: boolean }) {
  return (
    <Tile title="Помощник" className={wide ? "ov-span2" : undefined} action={canEdit ? <Link className="ov-link" href="/helper/new">+ Запись</Link> : undefined}>
      <p className="ov-muted ov-small">Решений в базе</p>
      <p className="ov-mid mono">{h.total}</p>
      {h.latest.length > 0 ? (
        <ul className="ov-list">
          {h.latest.map((a) => (
            <li key={a.id}><BookOpen size={14} aria-hidden /><Link href={`/helper/${a.id}`}>{a.title}</Link></li>
          ))}
        </ul>
      ) : (
        <p className="ov-small ov-muted">Пока пусто. Решили проблему — запишите.</p>
      )}
      <Link className="ov-link ov-foot-link" href="/helper">Все записи →</Link>
    </Tile>
  );
}

/* ---------- Activity ---------- */
const ICON: Record<string, ReactNode> = {
  printer: <Printer size={16} />,
  tmc_act: <FileText size={16} />,
  tmc_item: <FileText size={16} />,
  cartridge_move: <Package size={16} />,
  cartridge_model: <Package size={16} />,
  kb_article: <BookOpen size={16} />,
};

function ActivityTile({ items, now, reduced }: { items: NonNullable<OverviewData["activity"]>; now: number; reduced: boolean }) {
  const mounted = useMounted();
  return (
    <Tile title="Последние действия" className="ov-span4" action={<Link className="ov-link" href="/audit">Журнал →</Link>}>
      {items.length === 0 ? (
        <p className="ov-small ov-muted">Действий пока не было.</p>
      ) : (
        <ul className="ov-activity">
          {items.map((a, i) => (
            <li
              key={a.id}
              style={{
                opacity: mounted || reduced ? 1 : 0,
                transform: mounted || reduced ? "none" : "translateY(6px)",
                transition: reduced ? "none" : `opacity 500ms ease ${200 + i * 60}ms, transform 500ms ${EASE} ${200 + i * 60}ms`,
              }}
            >
              <span className="ov-icon" aria-hidden>{ICON[a.entity] ?? <User size={16} />}</span>
              <span className="ov-act-text"><b>{a.who}</b> {a.text}</span>
              <span className="mono ov-muted ov-small">{timeAgo(a.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

export default function Overview({ data, canEdit }: { data: OverviewData; canEdit: boolean }) {
  const reduced = useReducedMotion();
  return (
    <main className="wrap ov">
      <div className="ov-grid">
        <HeroTile d={data} reduced={reduced} />
        <FirstFreeTile d={data} />
        <GaugeTile d={data} reduced={reduced} />
        {data.cartridges && <CartridgesTile c={data.cartridges} reduced={reduced} />}
        {data.acts && <ActsTile a={data.acts} today={data.today} reduced={reduced} />}
        <HelperTile h={data.helper} canEdit={canEdit} wide={!data.acts} />
        {data.activity && <ActivityTile items={data.activity} now={data.now} reduced={reduced} />}
      </div>
    </main>
  );
}
