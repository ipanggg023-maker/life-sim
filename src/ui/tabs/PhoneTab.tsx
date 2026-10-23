import { useState } from "react";
import {
  CHAT_LINES,
  IG_PER_YEAR,
  IG_POSTS,
  YT_GENRES,
  YT_PER_YEAR,
  canSwipe,
  chat,
  fmt,
  igPost,
  invest,
  phoneOf,
  sellAll,
  specialGenre,
  startSwipe,
  ytLive,
  ytUpload,
} from "../../content/phone";
import type { Life } from "../../engine/types";
import { loc, money, relationLabel, shortName } from "../../engine/util";
import type { Act } from "../App";
import { Fold } from "../Fold";

type App = "home" | "ig" | "yt" | "dating" | "stocks" | "chat";

const APPS: { id: Exclude<App, "home">; emoji: string; name: string }[] = [
  { id: "ig", emoji: "📸", name: "IG" },
  { id: "yt", emoji: "▶️", name: "YouTube" },
  { id: "dating", emoji: "💘", name: "หาคู่" },
  { id: "stocks", emoji: "📈", name: "หุ้น" },
  { id: "chat", emoji: "💬", name: "แชต" },
];

const usedOf = (l: Life, key: string) => l.doneThisYear.filter((x) => x === key).length;

export function PhoneTab({ life, act }: { life: Life; act: Act }) {
  const [app, setApp] = useState<App>("home");
  const ph = phoneOf(life);
  const back = (
    <button className="btn small ghost phone-back" onClick={() => setApp("home")}>
      ← กลับหน้าหลัก
    </button>
  );

  if (app === "home")
    return (
      <div className="tab-content">
        <div className="phone-home">
          {APPS.map((a) => (
            <button key={a.id} className="phone-app" onClick={() => setApp(a.id)}>
              <span className="phone-icon">{a.emoji}</span>
              <span>{a.name}</span>
            </button>
          ))}
        </div>
        <p className="small muted">
          📸 {fmt(ph.ig)} ผู้ติดตาม · ▶️ {fmt(ph.yt)} ซับ · 📈 พอร์ต {money(life, ph.portfolio)}
        </p>
      </div>
    );

  if (app === "ig") {
    const left = IG_PER_YEAR - usedOf(life, "ig");
    return (
      <div className="tab-content">
        {back}
        <Fold always id="phone-0" title={<>📸 @{life.firstName}_{String(life.birthYear % 100).padStart(2, "0")}</>}>
          <p>
            <b>{fmt(ph.ig)}</b> ผู้ติดตาม · {ph.igPosts} โพสต์
            {ph.ig >= 10_000 && <span className="small muted"> · ได้งานรีวิวสินค้าทุกปี</span>}
          </p>
          <p className="small muted">โพสต์ได้อีก {left} ครั้งในปีนี้ · ผู้ติดตามหายปีละ 5% ถ้าไม่โพสต์ · ครบ 10K สมัครอาชีพอินฟลูเอนเซอร์ได้</p>
        </Fold>
        <div className="grid">
          {IG_POSTS.map((p) => {
            const blocked = left <= 0 ? "ปีนี้โพสต์ครบแล้ว" : p.need && !p.need(life) ? p.why : undefined;
            return (
              <button key={p.id} className="activity" disabled={!!blocked} onClick={() => act((l) => igPost(l, p.id))}>
                <span className="act-emoji">{p.emoji}</span>
                <span className="act-name">{p.name}</span>
                <span className="act-desc">{blocked ?? "โพสต์"}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (app === "yt") {
    const left = YT_PER_YEAR - usedOf(life, "yt");
    const special = specialGenre(life);
    return (
      <div className="tab-content">
        {back}
        <Fold always id="phone-1" title={<>▶️ ช่องของ {life.firstName}</>}>
          <p>
            <b>{fmt(ph.yt)}</b> ซับ · {ph.ytVideos} คลิป · {fmt(ph.ytViews)} วิวรวม
          </p>
          <p className="small muted">อัปได้อีก {left} คลิปในปีนี้ · ครบ 1K ซับเริ่มมีรายได้ · คลิปเก่ายังทำเงินทุกปี</p>
        </Fold>
        <div className="grid">
          {YT_GENRES.filter((g) => g.id !== "special" || special).map((g) => (
            <button key={g.id} className="activity" disabled={left <= 0} onClick={() => act((l) => ytUpload(l, g.id))}>
              <span className="act-emoji">{g.emoji}</span>
              <span className="act-name">{g.id === "special" ? loc(life, special!) : g.name}</span>
              <span className="act-desc">{left <= 0 ? "ปีนี้อัปครบแล้ว" : "อัปคลิป"}</span>
            </button>
          ))}
          <button className="activity" disabled={life.doneThisYear.includes("live") || ph.yt < 100} onClick={() => act(ytLive)}>
            <span className="act-emoji">🔴</span>
            <span className="act-name">ไลฟ์สด</span>
            <span className="act-desc">{ph.yt < 100 ? "ต้องมี 100 ซับ" : life.doneThisYear.includes("live") ? "ปีนี้ไลฟ์แล้ว" : "รับโดเนท (สตรีมเมอร์ได้ x2)"}</span>
          </button>
        </div>
      </div>
    );
  }

  if (app === "dating")
    return (
      <div className="tab-content">
        {back}
        <Fold always id="phone-2" title={<>💘 แอปหาคู่</>}>
          <p className="small muted">ปัดหาคนปีละครั้ง เลือกทักหนึ่งในสามโปรไฟล์ — โอกาสขึ้นกับรูปลักษณ์และเสน่ห์</p>
          <button className="btn primary" disabled={!canSwipe(life)} onClick={() => act((l) => void startSwipe(l))}>
            {life.age < 18 ? "ต้องอายุ 18+" : !canSwipe(life) && life.doneThisYear.includes("swipe") ? "ปีนี้ปัดแล้ว" : !canSwipe(life) ? "คุณมีคนรักแล้ว" : "เริ่มปัด"}
          </button>
        </Fold>
      </div>
    );

  if (app === "stocks")
    return (
      <div className="tab-content">
        {back}
        <Fold always id="phone-3" title={<>📈 พอร์ตหุ้น</>}>
          <p>
            มูลค่าพอร์ต <b>{money(life, ph.portfolio)}</b>
            {life.flags.lastReturn !== undefined && (
              <span className={Number(life.flags.lastReturn) >= 0 ? "good-text" : "danger-text"}> · ปีที่แล้ว {Number(life.flags.lastReturn) >= 0 ? "+" : ""}{String(life.flags.lastReturn)}%</span>
            )}
          </p>
          <p className="small muted">ตลาดขึ้นลงทุกปีตอนอายุเพิ่ม (-25% ถึง +35% และมีโอกาสตลาดพัง)</p>
          <div className="row">
            <button className="btn small" disabled={life.money <= 0} onClick={() => act((l) => invest(l, 0.1))}>ซื้อ 10% ของเงินสด</button>
            <button className="btn small" disabled={life.money <= 0} onClick={() => act((l) => invest(l, 0.5))}>ซื้อ 50%</button>
            <button className="btn small ghost" disabled={ph.portfolio <= 0} onClick={() => act(sellAll)}>ขายทั้งหมด</button>
          </div>
        </Fold>
      </div>
    );

  const contacts = life.people.filter((p) => p.alive);
  return (
    <div className="tab-content">
      {back}
      <p className="small muted">ทักแชตได้คนละครั้งต่อปี — ความผูกพันเพิ่มขึ้นเล็กน้อย ({CHAT_LINES.length} แบบ)</p>
      {contacts.length === 0 && <p className="muted">ยังไม่มีใครในรายชื่อ</p>}
      {contacts.map((p) => {
        const done = life.doneThisYear.includes(`chat:${p.id}`);
        return (
          <div className="job" key={p.id}>
            <div className="job-main">
              <div className="job-name">{shortName(p)}</div>
              <div className="job-sub">
                {relationLabel(p, life)} · ความผูกพัน {p.bond}
              </div>
            </div>
            <button className="btn small" disabled={done} onClick={() => act((l) => chat(l, p.id))}>
              {done ? "ทักแล้ว" : "💬 ทัก"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
