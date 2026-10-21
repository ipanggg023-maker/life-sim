import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloudEnabled, cloudInfo, currentUser, downloadSave, onAuthChange, setMark, signIn, signOut, signUp, uploadSave, type CloudInfo } from "../cloud";import type { Bundle } from "../save";

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

/** ช่องอีเมล + รหัสผ่าน · สมัคร / เข้าสู่ระบบ */
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  const run = async (fn: () => Promise<string | null | void>) => {
    setBusy(true);
    setMsg("");
    try {
      const err = await fn();
      if (err) setMsg(err);
    } catch {
      setMsg("เชื่อมต่อไม่ได้ — ตรวจอินเทอร์เน็ต");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !busy) void run(() => signIn(email, password));
      }}
    >
      <input className="field" type="email" autoComplete="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value.trim())} />
      <input className="field" type="password" autoComplete="current-password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="row">
        <button type="submit" className="btn primary" disabled={!ok || busy}>
          เข้าสู่ระบบ
        </button>
        <button
          type="button"
          className="btn"
          disabled={!ok || busy}
          onClick={() =>
            run(async () => {
              const r = await signUp(email, password);
              if (r.error) return r.error;
              if (r.needConfirm) setMsg("สมัครแล้ว — เปิดลิงก์ยืนยันในอีเมล แล้วกลับมากดเข้าสู่ระบบ");
            })
          }
        >
          สมัครใหม่
        </button>
      </div>
      {msg && <p className="small muted">{msg}</p>}
    </form>
  );
}

/** หน้าแรกก่อนเข้าเกม */
export function LoginScreen({ onGuest }: { onGuest: () => void }) {
  return (
    <div className="title-card login">
      <h1 className="login-title">ชีวิตนับร้อยชาติ</h1>
      <p className="muted small">เข้าสู่ระบบเพื่อเก็บเซฟไว้บนคลาวด์ เล่นต่อได้ทั้งคอมและมือถือ</p>
      <div className="card cloud">
        <LoginForm />
      </div>
      <button className="btn ghost" onClick={onGuest}>
        เล่นโดยไม่มีบัญชี (เซฟอยู่ในเครื่องนี้เท่านั้น)
      </button>
    </div>
  );
}

/** บัญชี + ซิงก์เซฟ PC ↔ มือถือ (Supabase) */
export function CloudCard({ bundle, onImport }: { bundle: Bundle; onImport: (b: Bundle) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [info, setInfo] = useState<CloudInfo | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cloudEnabled) return;
    let off = () => {};
    void currentUser().then(setUser);
    void onAuthChange(setUser).then((f) => (off = f));
    return () => off();
  }, []);

  useEffect(() => {
    if (user) void cloudInfo().then(setInfo);
    else setInfo(null);
  }, [user]);

  if (!cloudEnabled) return <p className="muted small">ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ซิงก์เซฟ</p>;

  const run = async (fn: () => Promise<string | null | void>) => {
    setBusy(true);
    setMsg("");
    try {
      const err = await fn();
      if (err) setMsg(err);
    } catch {
      setMsg("เชื่อมต่อไม่ได้ — ตรวจอินเทอร์เน็ต");
    } finally {
      setBusy(false);
    }
  };

  if (!user)
    return (
      <div className="card cloud">
        <p className="small muted">เข้าสู่ระบบแล้วเซฟจะซิงก์อัตโนมัติ เล่นต่อได้ทั้งคอมและมือถือ</p>
        <LoginForm />
      </div>
    );

  return (
    <div className="card cloud">
      <p className="small">
        ☁️ {user.email}
        <span className="muted"> · {info ? `ซิงก์ล่าสุด ${when(info.updatedAt)}` : "ยังไม่มีเซฟบนคลาวด์"}</span>
      </p>
      {info?.summary && (
        <p className="small muted">
          บนคลาวด์: {info.summary.lives} ชาติ{info.summary.name ? ` · ${info.summary.name} อายุ ${info.summary.age}` : ""}
        </p>
      )}
      <div className="row">
        <button
          className="btn small"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const err = await uploadSave(bundle);
              if (err) return err;
              setInfo(await cloudInfo());
              setMsg("อัปโหลดเซฟเครื่องนี้ขึ้นคลาวด์แล้ว");
            })
          }
        >
          ⬆️ อัปโหลดเซฟนี้
        </button>
        <button
          className="btn small"
          disabled={busy || !info}
          onClick={() =>
            run(async () => {
              const r = await downloadSave();
              if (!r) return "ไม่พบเซฟบนคลาวด์";
              setMark(r.updatedAt);
              onImport(r.bundle);
            })
          }
        >
          ⬇️ โหลดเซฟจากคลาวด์
        </button>
        <button className="btn small ghost" disabled={busy} onClick={() => run(signOut)}>
          ออกจากระบบ
        </button>
      </div>
      <p className="small muted">เซฟอัปโหลดอัตโนมัติระหว่างเล่น (ทุก ~20 วินาที และตอนปิดแอป)</p>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
