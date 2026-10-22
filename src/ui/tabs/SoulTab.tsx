import { useState, type ReactNode } from "react";
import { COUNTRIES } from "../../content/countries";
import { ACHIEVEMENTS, ACH_CATEGORY, catOf, type AchCategory } from "../../content/achievements";
import { TALENTS, RARITY_LABEL, talentById } from "../../content/talents";
import { facultyById } from "../../content/hunter/careers";
import { rankLabel } from "../../content/hunter/power";
import { ageUp, resolveChoice, STAT_LABEL, type BirthOptions } from "../../engine/game";
import { visibleChoices } from "../../engine/events";
import { memoryOdds } from "../../engine/memory";
import type { Country, Gender, Life, PastLife, Soul, Stats, Wealth, WorldId } from "../../engine/types";
import { isRealistic, worldOf } from "../../content/worlds";
import { COLLECTIBLES, SET_BONUS, completedSets, foundThisLife } from "../../content/shared/collection";
import { displayName, money } from "../../engine/util";
import { saveSnapshot, type Bundle } from "../../save";
import type { Act } from "../App";
import { SaveTransfer } from "../SaveTransfer";
import { CloudCard } from "../CloudCard";
import { goalById } from "../../content/murim/life/goals";
import { injuryLabel } from "../../engine/body";
import { SeriesCover } from "../SeriesCover";

export function SoulTab({
  life,
  soul,
  graveyard,
  dev,
  act,
  onNewLife,
  onImport,
}: {
  life: Life;
  soul: Soul;
  graveyard: PastLife[];
  dev: boolean;
  act: Act;
  onNewLife: (opts?: BirthOptions) => void;
  onImport: (b: Bundle) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const memories = life.memories ?? [];
  const real = isRealistic(life.worldId);
  return (
    <div className="tab-content">
      {real ? (
        <div className="card">
          <div className="card-title">บันทึกชีวิต</div>
          <p>
            ชีวิตที่ {graveyard.length + 1} · {displayName(life)} · ปี {life.birthYear}
          </p>
          <Fold
            title="ร่างกาย"
            items={(life.body?.injuries ?? []).map((i) => (
              <p className="small" key={i.id}>
                {i.sev === 3 ? "🩸" : "🤕"} {injuryLabel(i)} · ตั้งแต่อายุ {i.since}
                {i.cause && <span className="muted"> — {i.cause}</span>}
              </p>
            ))}
          />
          <Fold
            title="เป้าหมายชีวิต"
            items={(life.goals ?? []).slice().reverse().flatMap((g, i) => {
              const d = goalById(g.id);
              if (!d) return [];
              const st = g.end === "won" ? "✅ สำเร็จ" : g.end === "lost" ? "❌ ล้มเหลว" : g.end === "changed" ? "↪️ เปลี่ยนใจ" : `กำลังไล่ตาม (${g.step}/${d.steps.length})`;
              return [
                <p className="small" key={i}>
                  {d.emoji} {d.name}{g.side ? " (รอง)" : ""} · ตั้งแต่อายุ {g.since} · {st}
                  {g.why && <span className="muted"> — {g.why}</span>}
                </p>,
              ];
            })}
          />
          <Fold
            title="เหตุการณ์สำคัญของชีวิตนี้"
            items={(life.chron ?? []).slice().reverse().slice(0, 60).map((c, i) => (
              <p className="small" key={i}>
                ⭐ ปี {c.year} · {c.text}
              </p>
            ))}
          />
          <Fold
            title="บันทึกยุทธภพ"
            closed
            items={(soul.chronicle ?? []).slice().reverse().slice(0, 120).map((c, i) => (
              <p className="small" key={i}>
                {c.kind === "legend" ? "🌟" : c.kind === "life" ? "🪦" : "📯"} ปี {c.year} · {c.text}
                <span className="muted"> — {c.src}</span>
              </p>
            ))}
          />
        </div>
      ) : (
        <>
      <div className="sys-window">
        <div className="sys-head">บันทึกวิญญาณ</div>
        <p>
          ชาติที่ {graveyard.length + 1} · {displayName(life)} · ปี {life.birthYear}
        </p>
        <p>
          แต้มวิญญาณ: <b>{soul.points}</b> <span className="muted small">(สะสมทั้งหมด {soul.totalPoints})</span>
        </p>
        {(life.regressions ?? 0) > 0 && (
          <p>
            ย้อนเวลา {life.regressions} ครั้ง · ความเบี่ยงเบน {life.divergence ?? 0} · ความทรงจำยังตรง {Math.round(memoryOdds(life) * 100)}%
          </p>
        )}
        <p className="muted small">
          เตรียมไว้สำหรับชาติหน้า:{" "}
          {[
            soul.perks.blessing > 0 && "พรแห่งโชค",
            soul.perks.reroll > 0 && `สุ่มใหม่ ×${soul.perks.reroll}`,
            soul.perks.lockedTalent && `ผนึก「${talentById(soul.perks.lockedTalent)?.name}」`,
            soul.perks.clarity && "ความทรงจำแจ่มชัด",
          ]
            .filter(Boolean)
            .join(" · ") || "ยังไม่มี (ซื้อได้ที่หน้าจอหลังตาย)"}
        </p>
      </div>

      <div className="section-title">ความทรงจำจากชาติก่อน</div>
      {memories.length ? (
        <ul className="memories">
          {memories.map((m) => (
            <li key={m.key} className={m.key === "death" ? "danger-text" : ""}>
              {m.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">ยังไม่มี — ย้อนเวลาหลังตาย แล้วสิ่งที่คุณเห็นในชาตินี้จะกลายเป็นความทรงจำ</p>
      )}
        </>
      )}

      <div className="section-title">
        ความสำเร็จ {real ? ACHIEVEMENTS.filter((a) => a.cat === life.worldId && soul.achievements.includes(a.id)).length : soul.achievements.length}/{real ? ACHIEVEMENTS.filter((a) => a.cat === life.worldId).length : ACHIEVEMENTS.length}
      </div>
      {(Object.keys(ACH_CATEGORY) as AchCategory[]).filter((c) => !real || c === life.worldId).map((cat) => {
        const list = ACHIEVEMENTS.filter((a) => catOf(a) === cat);
        if (!list.length) return null;
        const got = list.filter((a) => soul.achievements.includes(a.id)).length;
        return (
          <details className="ach-cat" key={cat} open={cat === "life" || real}>
            <summary>
              {ACH_CATEGORY[cat]} · {got}/{list.length}
            </summary>
            <div className="ach-grid">
              {list.map((a) => {
                const have = soul.achievements.includes(a.id);
                const secret = a.hidden && !have;
                return (
                  <div className={`ach ${have ? "got" : ""}`} key={a.id} title={secret ? "ความสำเร็จลับ" : a.desc}>
                    <div className="ach-name">
                      {have ? "🏆" : "🔒"} {secret ? "???" : a.name}
                    </div>
                    <div className="ach-desc">
                      {secret ? "ความสำเร็จลับ" : a.desc} · +{a.points}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      {!real && graveyard.some((g) => g.series) && (
        <>
          <div className="section-title">📚 ชั้นหนังสือของวิญญาณ</div>
          <div className="shelf">
            {graveyard
              .filter((g) => g.series)
              .map((g) => (
                <SeriesCover key={g.id} series={g.series!} world={g.world} author={g.name} compact />
              ))}
          </div>
        </>
      )}

      {graveyard.length > 0 && (
        <Fold
          title="สุสาน"
          show={3}
          items={graveyard.map((g, i) => (
            <div className="grave" key={g.id}>
              <div className="grave-name">
                ชาติที่ {graveyard.length - i}: {g.name} · {g.age} ปี
                {g.rank !== undefined && <span className={`rank r${g.rank}`}> [{rankLabel({ worldId: g.world ?? "hunter" }, g.rank)}]</span>}
                {g.regressed && " ⏪"}
              </div>
              <div className="grave-sub">
                {g.cause} · {money({ worldId: g.world ?? "hunter" }, g.money)}
                {g.job ? ` · ${g.job}` : ""}
                {g.degree ? ` · ${facultyById(g.degree).name}` : ""}
                {g.points !== undefined && !real ? ` · +${g.points} แต้ม` : ""}
              </div>
            </div>
          ))}
        />
      )}

      {!real && <CollectionCard life={life} soul={soul} />}
      <TalentBookCard life={life} soul={soul} />

      <div className="section-title">บัญชี & ซิงก์เซฟ</div>
      <CloudCard bundle={{ v: 1, soul, life, graveyard }} onImport={onImport} />

      <div className="section-title">ย้ายเซฟไปอีกเครื่อง (QR / รหัส)</div>
      <SaveTransfer life={life} soul={soul} graveyard={graveyard} onImport={onImport} />

      <div className="section-title">ตัวเลือก</div>
      {!confirm ? (
        <button className="btn ghost" onClick={() => setConfirm(true)}>
          ทิ้งชีวิตนี้แล้วเกิดใหม่
        </button>
      ) : (
        <div className="row">
          <button className="btn danger" onClick={() => onNewLife()}>
            ยืนยัน (ชีวิตนี้จะหายไป)
          </button>
          <button className="btn ghost" onClick={() => setConfirm(false)}>
            ยกเลิก
          </button>
        </div>
      )}

      {dev && <DevPanel act={act} onNewLife={onNewLife} />}
    </div>
  );
}

/** สมุดพรสวรรค์: พรสวรรค์ที่วิญญาณเคยได้ในทุกชาติ แยกตามระดับ */
function TalentBookCard({ life, soul }: { life: Life; soul: Soul }) {
  const have = new Set([...(soul.talentBook ?? []), ...life.talents.filter((t) => t.revealed).map((t) => t.id)]);
  const order = ["mythic", "divine", "legendary", "rare", "common"] as const;
  return (
    <div className="card">
      <div className="card-title">
        📖 สมุดพรสวรรค์ · {TALENTS.filter((t) => have.has(t.id)).length}/{TALENTS.length}
      </div>
      <p className="muted small">พรสวรรค์ที่วิญญาณเคยได้ในทุกชาติ (พรสวรรค์ในช่องลับจะถูกบันทึกเมื่อจบชีวิต)</p>
      {order.map((r) => {
        const all = TALENTS.filter((t) => t.rarity === r);
        const got = all.filter((t) => have.has(t.id));
        return (
          <details key={r} className="book-row">
            <summary className="small">
              <b className={`rar-${r}`}>{RARITY_LABEL[r]}</b> {got.length}/{all.length}
            </summary>
            <div className="chips">
              {got.map((t) => (
                <span key={t.id} className={`chip ${r}`} title={t.desc}>
                  {t.name}
                </span>
              ))}
              {!got.length && <span className="muted small">ยังไม่เคยได้</span>}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** ตู้สะสม: ของที่วิญญาณมี (รวมที่เพิ่งเจอชาตินี้) แยกตามโลก */
function CollectionCard({ life, soul }: { life: Life; soul: Soul }) {
  const have = new Set([...(soul.collection ?? []), ...foundThisLife(life)]);
  const done = completedSets(have);
  return (
    <div className="card">
      <div className="card-title">
        🏺 ตู้สะสม · {have.size}/{COLLECTIBLES.length}
      </div>
      <p className="muted small">ของหายากที่เจอระหว่างใช้ชีวิต ติดตัววิญญาณทุกชาติ — ครบชุดของโลกไหน เกิดใหม่ได้โบนัสถาวร</p>
      {(Object.keys(SET_BONUS) as WorldId[]).map((w) => (
        <div key={w} className="collect-row">
          <div className="small">
            {worldOf(w).name} · {done.includes(w) ? <b>ครบชุด ✓ {SET_BONUS[w].label}</b> : <span className="muted">ครบชุดได้ {SET_BONUS[w].label}</span>}
          </div>
          <div className="collect-items">
            {COLLECTIBLES.filter((c) => c.world === w).map((c) => (
              <span key={c.id} className={have.has(c.id) ? "collect on" : "collect"} title={have.has(c.id) ? c.name : "ยังไม่เคยเจอ"}>
                {have.has(c.id) ? c.emoji : "❔"}
              </span>
            ))}
          </div>
          <div className="muted small">
            {COLLECTIBLES.filter((c) => c.world === w && have.has(c.id))
              .map((c) => c.name)
              .join(" · ")}
          </div>
        </div>
      ))}
    </div>
  );
}

const STAT_KEYS: (keyof Stats)[] = ["health", "happiness", "smarts", "looks", "luck"];

/** Admin: สร้างตัวละครแบบ D&D และกรอเวลา */
function DevPanel({ act, onNewLife }: { act: Act; onNewLife: (opts?: BirthOptions) => void }) {
  const [gender, setGender] = useState<Gender>("m");
  const [world, setWorld] = useState<WorldId>("hunter");
  const [country, setCountry] = useState<Country | "">("");
  const [firstName, setFirstName] = useState("");
  const [wealth, setWealth] = useState<Wealth>("middle");
  const [stats, setStats] = useState<Stats>({ health: 70, happiness: 70, smarts: 60, looks: 60, luck: 50 });
  const [talents, setTalents] = useState<string[]>([]);

  const skip = (years: number) =>
    act((l) => {
      for (let i = 0; i < years && l.alive; i++) {
        while (l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
        if (!l.alive) break;
        saveSnapshot(l);
        ageUp(l);
      }
      while (l.alive && l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
      return { text: `กรอเวลาไป ${years} ปี (เลือกตัวเลือกแรกอัตโนมัติ)` };
    });

  return (
    <div className="card dev">
      <div className="card-title">🛠️ Admin</div>
      <div className="row">
        <button className="btn small" onClick={() => skip(1)}>+1 ปี (auto)</button>
        <button className="btn small" onClick={() => skip(5)}>+5 ปี</button>
        <button className="btn small" onClick={() => skip(10)}>+10 ปี</button>
      </div>

      <div className="section-title">สร้างตัวละคร</div>
      <div className="row">
        <select value={world} onChange={(e) => setWorld(e.target.value as WorldId)}>
          <option value="hunter">🌀 โลก Hunter</option>
          <option value="murim">⛰️ ยุทธภพ</option>
          <option value="court">👑 ราชสำนัก</option>
          <option value="tower">🗼 หอคอย</option>
          <option value="apocalypse">☄️ วันสิ้นโลก</option>
          <option value="ordinary">🏙️ โลกธรรมดา</option>
        </select>
        {worldOf(world).modern && (
          <select value={country} onChange={(e) => setCountry(e.target.value as Country | "")}>
            <option value="">สุ่มประเทศ</option>
            {Object.values(COUNTRIES).map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        )}
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          <option value="m">ชาย</option>
          <option value="f">หญิง</option>
        </select>
        <select value={wealth} onChange={(e) => setWealth(e.target.value as Wealth)}>
          <option value="poor">ยากจน</option>
          <option value="middle">ชนชั้นกลาง</option>
          <option value="rich">มีฐานะ</option>
          <option value="elite">มหาเศรษฐี</option>
        </select>
        <input placeholder="ชื่อ (ว่าง = สุ่ม)" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      {STAT_KEYS.map((k) => (
        <label className="slider" key={k}>
          <span>
            {STAT_LABEL[k]} {stats[k]}
          </span>
          <input type="range" min={0} max={100} value={stats[k]} onChange={(e) => setStats({ ...stats, [k]: Number(e.target.value) })} />
        </label>
      ))}
      <div className="chips">
        {TALENTS.map((t) => (
          <button
            key={t.id}
            className={`chip ${t.rarity} ${talents.includes(t.id) ? "on" : ""}`}
            onClick={() => setTalents(talents.includes(t.id) ? talents.filter((x) => x !== t.id) : [...talents, t.id])}
            title={`${RARITY_LABEL[t.rarity]} · ${t.desc}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <button
        className="btn primary"
        onClick={() => onNewLife({ worldId: world, country: country || undefined, gender, wealth, stats, talents, firstName: firstName.trim() || undefined })}
      >
        เกิดด้วยค่านี้
      </button>
    </div>
  );
}

/** หมวดในบันทึกชีวิตที่ย่อได้: แตะหัวข้อเพื่อพับ · แสดงล่าสุดไม่กี่เรื่อง แล้วกดดูทั้งหมด */
function Fold({ title, items, show = 5, closed = false }: { title: string; items: ReactNode[]; show?: number; closed?: boolean }) {
  const [all, setAll] = useState(false);
  // คุมสถานะเปิด/ปิดเอง (ไม่ให้วาดใหม่แล้วพับกลับ)
  const [open, setOpen] = useState(!closed);
  if (!items.length) return null;
  return (
    <details className="fold" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="section-title">
        {title} <span className="muted small">({items.length})</span>
      </summary>
      {all ? items : items.slice(0, show)}
      {items.length > show && (
        <button className="btn small ghost fold-more" onClick={() => setAll(!all)}>
          {all ? "ย่อ" : `ดูทั้งหมด (${items.length})`}
        </button>
      )}
    </details>
  );
}
