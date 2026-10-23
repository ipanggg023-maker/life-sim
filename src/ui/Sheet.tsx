import type { ReactNode } from "react";
import { Icon, noEmoji } from "./Icon";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{noEmoji(title)}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
