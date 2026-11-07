// หน้าตาในแถบของโลกแฟนตาซี (ตามตัวอย่าง R25 ที่อนุมัติ): สรุปสั้นๆ บนสุด → สามอย่างที่ควรทำพร้อมป้าย → ที่เหลือพับไว้
// หน้าหลักและแถบล่างไม่เปลี่ยน · ข้อมูลมาจาก content/fantasy/glance.ts
import type { ReactNode } from "react";
import { FoldAll } from "../Fold";
import { Icon, noEmoji, type IconName } from "../Icon";

export type Tone = "good" | "bad" | "warn" | "star";
/** ป้ายผล: เดาสีจากข้อความ (+ ดี · − หรือเสี่ยง ร้าย · ค่าใช้จ่ายและโอกาส เตือน · พลัง ดาว) */
export const toneOf = (t: string): Tone =>
  /^−(?!\d)|เสี่ยง|ต่ำ|หนี้/.test(t) ? "bad" : /^−\d|สำเร็จ|ปีละ|ปี$/.test(t) ? "warn" : /พลัง|เวท|กาย|ชื่อเสียง|ตำนาน/.test(t) ? "star" : "good";

/** ครอบเนื้อหาของแถบ: ส่วนที่เคยแสดงตลอดจะพับไว้ทั้งหมด */
export function R25({ children }: { children: ReactNode }) {
  return (
    <FoldAll.Provider value={true}>
      <div className="r25">{children}</div>
    </FoldAll.Provider>
  );
}

/** สรุปบนสุด: หัวข้อสั้นทางซ้าย ค่าทางขวา ไม่เกินห้าบรรทัด */
export function Glance({ rows }: { rows: ([string, ReactNode, Tone?] | false | undefined | null)[] }) {
  const list = rows.filter(Boolean) as [string, ReactNode, Tone?][];
  if (!list.length) return null;
  return (
    <div className="glance">
      {list.slice(0, 5).map(([k, v, tone]) => (
        <div className="glance-row" key={k}>
          <span className="glance-k">{k}</span>
          <span className={`glance-v ${tone ?? ""}`}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export interface TopItem { key: string; icon: IconName; name: string; why?: string; tags?: string[]; onClick?: () => void }
/** สามอย่างที่ควรทำ · กดแล้วทำเลย (ถ้ามี) */
export function TopActs({ title, hint, items }: { title: string; hint?: string; items: TopItem[] }) {
  if (!items.length) return null;
  return (
    <>
      <Cap text={title} hint={hint} />
      {items.slice(0, 3).map((x) => {
        const body = (
          <>
            <span className="top-ic"><Icon name={x.icon} size={18} /></span>
            <span className="top-t">
              <span className="top-n">{noEmoji(x.name)}</span>
              {x.why && <span className="top-why">{noEmoji(x.why)}</span>}
              {!!x.tags?.length && <span className="tags">{x.tags.slice(0, 3).map((t) => <span key={t} className={`tag ${toneOf(t)}`}>{t}</span>)}</span>}
            </span>
            {x.onClick && <span className="top-chev">›</span>}
          </>
        );
        return x.onClick ? <button key={x.key} className="top-act" onClick={x.onClick}>{body}</button> : <div key={x.key} className="top-act still">{body}</div>;
      })}
    </>
  );
}

/** หัวข้อคั่น เส้นทองจางไปทางขวา */
export const Cap = ({ text, hint }: { text: string; hint?: string }) => (
  <div className="glance-cap">
    {text}
    {hint && <small>{hint}</small>}
  </div>
);
