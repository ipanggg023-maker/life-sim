import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

// การ์ด/หัวข้อที่ย่อ/ขยายได้ในแผ่นเลื่อน — ย่อไว้ก่อน เปิดเฉพาะอันที่อยากดู และจำไว้ว่าเปิดอันไหน (เก็บในเครื่องนี้)
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

/** คำสั่ง "เปิดทั้งหมด / ย่อทั้งหมด" จากหัวแผ่นเลื่อน (n เพิ่มทุกครั้งที่กด) */
export const FoldCmd = createContext<{ open: boolean; n: number }>({ open: false, n: 0 });

/** kind="card": การ์ดทั้งใบ · kind="section": หัวข้อย่อยในการ์ดหรือในแผ่น · force: บังคับเปิด (เช่น แตะชื่อคนจากบันทึก) */
export function Fold({ id, title, className = "", kind = "card", force = false, children }: { id: string; title: ReactNode; className?: string; kind?: "card" | "section"; force?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(() => force || readOpen().has(id));
  const cmd = useContext(FoldCmd);
  useEffect(() => {
    if (cmd.n > 0) {
      setOpen(cmd.open);
      saveOpen(id, cmd.open);
    }
  }, [cmd, id]);
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
