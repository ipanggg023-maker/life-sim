import { useState, type ReactNode } from "react";
import { FoldCmd } from "./Fold";
import { Icon, noEmoji } from "./Icon";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // เปิดทั้งหมด / ย่อทั้งหมด — ส่งให้ทุกการ์ดที่ย่อได้ในแผ่นนี้
  const [cmd, setCmd] = useState({ open: false, n: 0 });
  const all = (open: boolean) => setCmd((c) => ({ open, n: c.n + 1 }));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{noEmoji(title)}</h2>
          <div className="sheet-tools">
            <button className="fold-all" onClick={() => all(true)}>
              เปิดทั้งหมด
            </button>
            <button className="fold-all" onClick={() => all(false)}>
              ย่อทั้งหมด
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="ปิด">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
        <FoldCmd.Provider value={cmd}>
          <div className="sheet-body">{children}</div>
        </FoldCmd.Provider>
      </div>
    </div>
  );
}
