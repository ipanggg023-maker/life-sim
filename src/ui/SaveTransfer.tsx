import { useState } from "react";
import QRCode from "qrcode";
import type { Life, PastLife, Soul } from "../engine/types";
import { exportCode, importCode, type Bundle } from "../save";

/** QR ความจุสูงสุด ~2,900 ตัวอักษร (byte mode, ระดับแก้ผิด L) */
const QR_LIMIT = 2800;

export function SaveTransfer({
  life,
  soul,
  graveyard,
  onImport,
}: {
  life: Life;
  soul: Soul;
  graveyard: PastLife[];
  onImport: (b: Bundle) => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [paste, setPaste] = useState("");
  const bundle: Bundle = { v: 1, soul, life, graveyard };

  const makeQr = async () => {
    setMsg("");
    const code = await exportCode(bundle, true);
    const url = `${location.origin}${location.pathname}#import=${code}`;
    if (url.length > QR_LIMIT) {
      setQr(null);
      setMsg(`เซฟใหญ่เกินกว่าจะใส่ใน QR (${url.length} ตัวอักษร) — ใช้ "คัดลอกรหัส" แทน`);
      return;
    }
    setQr(await QRCode.toDataURL(url, { errorCorrectionLevel: "L", margin: 1, width: 320 }));
    setMsg("สแกนด้วยกล้องมือถือ แล้วเปิดลิงก์ — บันทึกชีวิตจะถูกย่อเหลือเฉพาะเหตุการณ์สำคัญ");
  };

  const copy = async () => {
    const code = await exportCode(bundle, false);
    try {
      await navigator.clipboard.writeText(code);
      setMsg(`คัดลอกรหัสเซฟแล้ว (${code.length.toLocaleString()} ตัวอักษร) — ไปวางที่ช่อง "นำเข้า" ในอีกเครื่อง`);
    } catch {
      download(code);
    }
  };

  const download = async (pre?: string) => {
    const code = pre ?? (await exportCode(bundle, false));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = `lifesim-save-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("ดาวน์โหลดไฟล์เซฟแล้ว");
  };

  const doImport = async (code: string) => {
    try {
      onImport(await importCode(code));
    } catch {
      setMsg("รหัสเซฟไม่ถูกต้อง");
    }
  };

  return (
    <div className="card">
      <div className="row">
        <button className="btn small" onClick={makeQr}>
          สร้าง QR
        </button>
        <button className="btn small" onClick={copy}>
          คัดลอกรหัส
        </button>
        <button className="btn small" onClick={() => download()}>
          ดาวน์โหลดไฟล์
        </button>
      </div>
      {qr && <img className="qr" src={qr} alt="QR สำหรับย้ายเซฟ" />}
      {msg && <p className="small muted">{msg}</p>}

      <div className="section-title">นำเข้า</div>
      <textarea className="paste" rows={3} placeholder="วางรหัสเซฟที่นี่" value={paste} onChange={(e) => setPaste(e.target.value)} />
      <div className="row">
        <button className="btn small" disabled={!paste.trim()} onClick={() => doImport(paste)}>
          นำเข้ารหัส
        </button>
        <label className="btn small">
          เปิดไฟล์เซฟ
          <input
            type="file"
            accept=".txt,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) doImport(await f.text());
            }}
          />
        </label>
      </div>
    </div>
  );
}
