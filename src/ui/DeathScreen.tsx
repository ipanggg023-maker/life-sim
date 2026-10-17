import { useState } from "react";
import { careerById, facultyById } from "../content/hunter/careers";
import { rankLabel } from "../content/hunter/power";
import { worldOf } from "../content/worlds";
import { finaleComments, seriesOf } from "../content/manhwa";
import { Comments } from "./MainScreen";
import { SeriesCover } from "./SeriesCover";
import { talentById } from "../content/talents";
import { SHOP, heirsOf, previewAward, regressTarget } from "../engine/soul";
import type { Life, Soul, WorldId } from "../engine/types";
import { WORLDS } from "../content/worlds";
import { displayName, loc, money, people } from "../engine/util";

export type RebirthChoice = "regress" | "nextEra" | `world:${WorldId}` | `heir:${string}`;

export function DeathScreen({
  life,
  soul,
  lifeNumber,
  onSoulChange,
  onRebirth,
}: {
  life: Life;
  soul: Soul;
  lifeNumber: number;
  onSoulChange: (s: Soul) => void;
  onRebirth: (c: RebirthChoice) => void;
}) {
  const [busy, setBusy] = useState(false);
  const job = life.job ? careerById(life.job.careerId) : undefined;
  const kids = people(life, "child", false).length;
  const spouse = people(life, "spouse").length > 0;
  const claimed = soul.awarded.includes(life.id);
  const award = previewAward(soul, life);
  const series = seriesOf(life);
  const achPoints = award.achievements.reduce((s, a) => s + a.points, 0);
  const target = regressTarget(life);
  // ใช้แต้มชาตินี้ซื้อของได้ก่อนเลือกทาง — นับแบบต่ำสุด (กรณีย้อนเวลาได้แต้มพื้นฐานครึ่งเดียว) กันแต้มติดลบ
  const wallet = soul.points + (claimed ? 0 : Math.round(award.base / 2) + achPoints);
  const spendable = (cost: number) => wallet >= cost;

  const buy = (key: keyof typeof SHOP, apply: (s: Soul) => void) => {
    const cost = SHOP[key].cost;
    if (!spendable(cost)) return;
    const s = { ...soul, perks: { ...soul.perks } };
    s.points -= cost; // อาจติดลบชั่วคราว แล้วชดเชยตอน claimAward
    apply(s);
    onSoulChange(s);
  };

  const go = (c: RebirthChoice) => {
    if (busy) return;
    setBusy(true);
    onRebirth(c);
  };

  const revealed = life.talents.filter((t) => t.revealed);

  return (
    <div className="death">
      <div className="tomb">
        <div className="rip">⚰️</div>
        <h2>
          {displayName(life)}
        </h2>
        <p className="muted">
          {life.birthYear} – {life.birthYear + life.age} · อายุ {life.age} ปี
          {(life.regressions ?? 0) > 0 && ` · ย้อนเวลา ${life.regressions} ครั้ง`}
        </p>
        <p className="cause">{loc(life, life.causeOfDeath ?? "")}</p>
      </div>

      <SeriesCover series={series} world={life.worldId} author={displayName(life)} />
      <Comments items={finaleComments(life)} />

      <div className="card">
        <div className="card-title">สรุปชีวิต</div>
        <p>ทรัพย์สินสุทธิ: {money(life, life.money - life.debt)}</p>
        <p>
          การศึกษา:{" "}
          {life.education.degree ? `ปริญญาตรี ${facultyById(life.education.degree).name}` : life.education.highSchoolDone ? "ม.6" : "ไม่จบ ม.6"}
        </p>
        <p>งานสุดท้าย: {job ? `${job.titles[life.job!.level - 1]} (${job.name})` : "-"}</p>
        {life.power && <p>{worldOf(life.worldId).labels.rank}: {rankLabel(life, life.power.rank)} · Lv.{life.power.level} · {life.worldId === "tower" ? `ชั้นที่ ${Number(life.flags.floor ?? 0)} ·` : ""}{life.worldId === "murim" ? "ภารกิจ" : life.worldId === "tower" ? "บททดสอบ" : life.worldId === "apocalypse" ? "ฉากภารกิจ" : life.worldId === "ordinary" ? "ภารกิจระบบ" : "Gate"} {life.power.gates}</p>}
        <p>
          ครอบครัว: {spouse ? "แต่งงาน" : "โสด"} · ลูก {kids} คน · ชื่อเสียง {life.fame}
        </p>
        <p>
          พรสวรรค์: {life.talents.map((t) => (t.revealed ? talentById(t.id)?.name : "??? (ไม่ได้เปิด)")).join(", ")}
        </p>
      </div>

      <div className="sys-window">
        <div className="sys-head">ระบบ · บันทึกวิญญาณ</div>
        <p>ชีวิตที่ {lifeNumber} สิ้นสุดลง วิญญาณของคุณยังไม่ดับสูญ…</p>
        {!claimed && (
          <>
            <p>
              แต้มวิญญาณจากชาตินี้: <b>+{award.base}</b>
              {achPoints > 0 && <> · ความสำเร็จใหม่ <b>+{achPoints}</b></>}
            </p>
            {award.achievements.map((a) => (
              <p className="small" key={a.id}>
                🏆 {a.name} — {a.desc} (+{a.points})
              </p>
            ))}
          </>
        )}
        <p>
          แต้มที่ใช้ได้ตอนนี้: <b>{wallet}</b>
          {!claimed && <span className="muted small"> (ถ้าไม่ย้อนเวลา จะได้เพิ่มอีก {award.base - Math.round(award.base / 2)})</span>}
        </p>
      </div>

      <div className="section-title">ร้านวิญญาณ</div>
      <div className="shop">
        <ShopItem
          name={SHOP.blessing.name}
          desc={SHOP.blessing.desc}
          cost={SHOP.blessing.cost}
          owned={soul.perks.blessing > 0 ? "เตรียมไว้แล้ว" : undefined}
          disabled={soul.perks.blessing > 0 || !spendable(SHOP.blessing.cost)}
          onBuy={() => buy("blessing", (s) => (s.perks.blessing = 1))}
        />
        <ShopItem
          name={SHOP.reroll.name}
          desc={SHOP.reroll.desc}
          cost={SHOP.reroll.cost}
          owned={soul.perks.reroll ? `มี ${soul.perks.reroll}` : undefined}
          disabled={!spendable(SHOP.reroll.cost)}
          onBuy={() => buy("reroll", (s) => s.perks.reroll++)}
        />
        <ShopItem
          name={SHOP.clarity.name}
          desc={SHOP.clarity.desc}
          cost={SHOP.clarity.cost}
          owned={soul.perks.clarity ? "ปลดล็อกแล้ว" : undefined}
          disabled={soul.perks.clarity || !spendable(SHOP.clarity.cost)}
          onBuy={() => buy("clarity", (s) => (s.perks.clarity = true))}
        />
      </div>
      {revealed.length > 0 && (
        <div className="card">
          <div className="card-title">
            {SHOP.lock.name} · {SHOP.lock.cost} แต้ม
          </div>
          <p className="muted small">{SHOP.lock.desc} (ไม่มีผลกับการย้อนเวลา เพราะร่างเดิมมีอยู่แล้ว)</p>
          <div className="chips">
            {revealed.map((t) => {
              const info = talentById(t.id)!;
              const on = soul.perks.lockedTalent === t.id;
              return (
                <button
                  key={t.id}
                  className={`chip ${info.rarity} ${on ? "on" : ""}`}
                  disabled={!on && (!!soul.perks.lockedTalent || !spendable(SHOP.lock.cost))}
                  onClick={() => !on && buy("lock", (s) => (s.perks.lockedTalent = t.id))}
                >
                  {on ? "🔒 " : ""}
                  {info.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="section-title">เส้นทางต่อไปของวิญญาณ</div>
      <button className="path" disabled={busy} onClick={() => go("regress")}>
        <span className="path-title">⏪ ย้อนเวลา</span>
        <span className="path-desc">
          ตื่นขึ้นในร่างเดิมตอนอายุ {target} ปี พร้อมความทรงจำทั้งหมด · แต้มชาตินี้ได้ครึ่งเดียว · อนาคตจะเพี้ยนขึ้นเรื่อยๆ (ความเบี่ยงเบน{" "}
          {life.divergence ?? 0} → {(life.divergence ?? 0) + (soul.perks.clarity ? 6 : 12)})
        </span>
      </button>
      {heirsOf(life).map((c) => (
        <button className="path" key={c.id} disabled={busy} onClick={() => go(`heir:${c.id}`)}>
          <span className="path-title">👶 เล่นต่อเป็น{c.gender === "m" ? "ลูกชาย" : "ลูกสาว"} — {c.name}</span>
          <span className="path-desc">
            ภาคต่อของเรื่องเดิม · อายุ {c.age} ปี · รับมรดก{heirsOf(life).length > 1 ? `ส่วนแบ่ง 1/${heirsOf(life).length}` : "ทั้งหมด"} และชื่อเสียงตระกูล
          </span>
        </button>
      ))}
      <button className="path" disabled={busy} onClick={() => go("nextEra")}>
        <span className="path-title">🌏 เกิดใหม่ในยุคถัดไป</span>
        <span className="path-desc">โลกเดิม หลายสิบปีต่อมา — ตระกูล{life.lastName}และสิ่งที่คุณทิ้งไว้ยังอยู่ อาจได้เกิดเป็นทายาทของตัวเอง</span>
      </button>
      <div className="section-title">✨ เกิดใหม่ในเส้นเวลาใหม่ — เลือกโลก</div>
      {Object.values(WORLDS).map((w) => (
        <button className="path" key={w.id} disabled={busy} onClick={() => go(`world:${w.id}`)}>
          <span className="path-title">
            {w.emoji} {w.name}
          </span>
          <span className="path-desc">
            {w.id === life.worldId
              ? "โลกเดิม แต่ทุกอย่างเริ่มใหม่หมด"
              : `วิญญาณข้ามโลก — ความทรงจำของ${displayName(life)}อาจกลับมาในฝัน${life.power ? " พร้อมวิชาจากชาตินี้" : ""}`}
          </span>
        </button>
      ))}
    </div>
  );
}

function ShopItem(p: { name: string; desc: string; cost: number; owned?: string; disabled: boolean; onBuy: () => void }) {
  return (
    <div className="shop-item">
      <div>
        <div className="job-name">{p.name}</div>
        <div className="job-sub">{p.desc}</div>
      </div>
      <button className="btn small" disabled={p.disabled} onClick={p.onBuy}>
        {p.owned ?? `${p.cost} แต้ม`}
      </button>
    </div>
  );
}
