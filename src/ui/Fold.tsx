import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

// การ์ด/หัวข้อในแผ่นเลื่อน: ส่วนสำคัญแสดงตลอด (always) · รายละเอียดปลีกย่อยย่อไว้ เปิดเมื่ออยากดู และจำไว้ว่าเปิดอันไหน (เก็บในเครื่องนี้)
const KEY = "ls.folds";
function readOpen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveOpen(id: string, open: boolean) {
  try {
    const s = readOpen();
    if (open) s.add(id);
    else s.delete(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ไม่มีที่เก็บ — ใช้ได้แค่ในรอบนี้ */
  }
}

/** kind="card": การ์ดทั้งใบ · kind="section": หัวข้อย่อยในการ์ดหรือในแผ่น
 *  always: ส่วนสำคัญ แสดงตลอดเหมือนการ์ดปกติ (ไม่มีปุ่มย่อ) — ย่อเฉพาะรายละเอียดปลีกย่อย · force: บังคับเปิด (เช่น แตะชื่อคนจากบันทึก) */
export function Fold(props: { id: string; title: ReactNode; className?: string; kind?: "card" | "section"; force?: boolean; always?: boolean; children: ReactNode }) {
  const { title, className = "", kind = "card", always, children } = props;
  if (always)
    return kind === "card" ? (
      <div className={`card ${className}`}>
        <div className="card-title">{title}</div>
        {children}
      </div>
    ) : (
      <>
        <div className="section-title">{title}</div>
        {children}
      </>
    );
  return <Folding {...props} />;
}

function Folding({ id, title, className = "", kind = "card", force = false, children }: { id: string; title: ReactNode; className?: string; kind?: "card" | "section"; force?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(() => force || readOpen().has(id));
  useEffect(() => {
    if (force) setOpen(true);
  }, [force]);
  return (
    <details
      className={`${kind === "card" ? "card fold-card" : "fold-section"} ${className}`}
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        if (now !== open) {
          setOpen(now);
          saveOpen(id, now);
        }
      }}
    >
      <summary className={`${kind === "card" ? "card-title" : "section-title"} fold-head`}>
        <span className="fold-title">{title}</span>
        <Icon name="chevron" size={16} className="fold-chevron" />
      </summary>
      {open && <div className="fold-body">{children}</div>}
    </details>
  );
}
