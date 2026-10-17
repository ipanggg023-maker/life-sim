import { useCallback, useEffect, useRef, useState } from "react";
import { ageUp, createLife, pastSelfOf, resolveChoice, toPastLife, type BirthOptions } from "../engine/game";
import { currentScene, labelOf, type Outcome } from "../engine/events";
import { buildHeir, buildRegression, claimAward, nextEraOptions, regressTarget } from "../engine/soul";
import type { Life, PastLife, Soul, WorldId } from "../engine/types";
import { loc } from "../engine/util";
import { WORLDS } from "../content/worlds";

const pickWorld = () => {
  const ids = Object.keys(WORLDS) as WorldId[];
  return ids[Math.floor(Math.random() * ids.length)];
};
import {
  addToGraveyard,
  applyBundle,
  clearCurrent,
  importCode,
  loadCurrent,
  loadGraveyard,
  loadSnapshot,
  loadSoul,
  pruneSnapshots,
  requestPersistence,
  saveCurrent,
  saveSnapshot,
  saveSoul,
  updateGraveyardPoints,
  type Bundle,
} from "../save";
import { BirthScreen } from "./BirthScreen";
import { DeathScreen, type RebirthChoice } from "./DeathScreen";
import { EventModal, OutcomeModal, type Resolved } from "./EventModal";
import { MainScreen, type TabId } from "./MainScreen";
import { Sheet } from "./Sheet";
import { ActivitiesTab } from "./tabs/ActivitiesTab";
import { CareerTab } from "./tabs/CareerTab";
import { PeopleTab } from "./tabs/PeopleTab";
import { PowerTab } from "./tabs/PowerTab";
import { SoulTab } from "./tabs/SoulTab";

export const DEV = new URLSearchParams(location.search).has("dev");

/** ฟังก์ชันที่แท็บต่างๆ ใช้แก้ไขชีวิต แล้วให้ App วาดใหม่และเซฟ */
export type Act = (fn: (life: Life) => Outcome | void) => void;

export function App() {
  const [life, setLife] = useState<Life | null>(null);
  const [soul, setSoul] = useState<Soul | null>(null);
  const [graveyard, setGraveyard] = useState<PastLife[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState<TabId | null>(null);
  const [toast, setToast] = useState<Outcome | null>(null);
  const [shake, setShake] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [birthOpts, setBirthOpts] = useState<BirthOptions>({});
  const [pendingImport, setPendingImport] = useState<Bundle | null>(null);
  const toastTimer = useRef<number>(undefined);

  useEffect(() => {
    (async () => {
      const [cur, grave, s] = await Promise.all([loadCurrent(), loadGraveyard(), loadSoul()]);
      setGraveyard(grave);
      setSoul(s);
      if (cur) {
        setLife(cur);
        setStarted(true);
      }
      setLoading(false);
      requestPersistence();
      // สแกน QR จากอีกเครื่อง → เปิดลิงก์ #import=...
      const m = location.hash.match(/^#import=(.+)$/);
      if (m) {
        history.replaceState(null, "", location.pathname + location.search);
        try {
          setPendingImport(await importCode(m[1]));
        } catch {
          alert("รหัสเซฟในลิงก์ไม่ถูกต้อง");
        }
      }
    })();
  }, []);

  // ธีมเปลี่ยนตามโลก (หน้าต่างระบบสีฟ้าเหมือนเดิมทุกโลก)
  useEffect(() => {
    document.documentElement.dataset.world = life?.worldId ?? "hunter";
  }, [life?.worldId]);

  const flash = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  }, []);

  const commit = useCallback(async (l: Life) => {
    setLife({ ...l });
    await saveCurrent(l);
    if (!l.alive) setGraveyard(await addToGraveyard(toPastLife(l)));
  }, []);

  const commitSoul = useCallback(async (s: Soul) => {
    setSoul({ ...s, perks: { ...s.perks } });
    await saveSoul(s);
  }, []);

  const feedback = useCallback(
    (out: Outcome | void) => {
      if (!out?.text) return;
      setToast(out);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 2600);
      if (out.kind === "bad") flash();
    },
    [flash],
  );

  const act: Act = useCallback(
    (fn) => {
      if (!life) return;
      const out = fn(life);
      feedback(out && { ...out, text: loc(life, out.text) });
      commit(life);
    },
    [life, commit, feedback],
  );

  /** เกิดใหม่ (ใช้พรแห่งโชค/พรสวรรค์ที่ผนึกไว้ถ้ามี) */
  const birth = useCallback(
    async (opts: BirthOptions = {}) => {
      const s = soul ?? (await loadSoul());
      const full: BirthOptions = {
        ...opts,
        blessed: opts.blessed ?? s.perks.blessing > 0,
        inheritTalent: opts.inheritTalent ?? s.perks.lockedTalent,
      };
      if (full.blessed) s.perks.blessing = 0;
      s.perks.lockedTalent = undefined;
      await commitSoul(s);
      const l = createLife(full);
      setBirthOpts(full);
      setStarted(false);
      setTab(null);
      await pruneSnapshots();
      await saveSnapshot(l);
      await commit(l);
    },
    [soul, commit, commitSoul],
  );

  const reroll = useCallback(async () => {
    if (!soul || soul.perks.reroll <= 0) return;
    soul.perks.reroll--;
    await commitSoul(soul);
    const l = createLife({ ...birthOpts, seed: undefined });
    await pruneSnapshots();
    await saveSnapshot(l);
    await commit(l);
  }, [soul, birthOpts, commit, commitSoul]);

  const onAgeUp = useCallback(async () => {
    if (!life) return;
    await saveSnapshot(life); // สถานะตอนสิ้นปี — จุดที่ย้อนเวลากลับมาได้
    ageUp(life);
    commit(life);
    if (life.log[life.log.length - 1]?.kind === "bad") flash();
  }, [life, commit, flash]);

  const onChoose = useCallback(
    (index: number) => {
      if (!life) return;
      const q = life.queue[0];
      const scene = currentScene(q, life)!;
      const prompt = loc(life, scene.text(life, q.ctx));
      const choice = loc(life, labelOf(scene.choices[index], life, q.ctx));
      const out = resolveChoice(life, index);
      if (out) {
        setResolved({ title: scene.title, prompt, choice, out: { ...out, text: loc(life, out.text) } });
        if (out.kind === "bad") flash();
      }
      commit(life);
    },
    [life, commit, flash],
  );

  const onRebirth = useCallback(
    async (choice: RebirthChoice) => {
      if (!life || !soul) return;
      const gained = claimAward(soul, life, choice === "regress");
      await commitSoul(soul);
      setGraveyard(await updateGraveyardPoints(life.id, gained));
      if (choice === "regress") {
        const snap = await loadSnapshot(life.id, regressTarget(life));
        const next = buildRegression(life, snap, soul.perks.clarity);
        await pruneSnapshots();
        setTab(null);
        setStarted(true);
        await commit(next);
        return;
      }
      await clearCurrent();
      if (choice.startsWith("heir:")) {
        // ภาคต่อ: เล่นต่อเป็นลูก — เริ่มทันทีโดยไม่ผ่านหน้าสุ่มเกิด
        const next = buildHeir(life, choice.slice(5));
        await clearCurrent();
        await pruneSnapshots();
        await saveSnapshot(next);
        setTab(null);
        setStarted(true);
        await commit(next);
        return;
      }
      if (choice === "nextEra") {
        await birth({ ...nextEraOptions(life), worldId: life.worldId });
        return;
      }
      // เส้นเวลาใหม่: ผู้เล่นเลือกโลกเอง — ข้ามโลกได้ฟรี วิญญาณพาความทรงจำไปด้วย
      await birth({ worldId: choice.slice(6) as WorldId, pastLife: pastSelfOf(life) });
    },
    [life, soul, birth, commit, commitSoul],
  );

  if (loading || !soul) return <div className="app center">กำลังโหลด…</div>;

  if (pendingImport) {
    return (
      <div className="app center">
        <div className="title-card">
          <div className="sys-window">
            <div className="sys-head">นำเข้าเซฟ</div>
            <p>
              พบเซฟจากอีกเครื่อง: วิญญาณ {pendingImport.soul.lives} ชาติ · แต้ม {pendingImport.soul.points}
              {pendingImport.life && ` · ชีวิตปัจจุบัน ${pendingImport.life.firstName} อายุ ${pendingImport.life.age}`}
            </p>
            <p className="muted small">เซฟในเครื่องนี้จะถูกแทนที่ทั้งหมด</p>
          </div>
          <button
            className="btn primary big"
            onClick={async () => {
              await applyBundle(pendingImport);
              location.reload();
            }}
          >
            นำเข้า
          </button>
          <button className="btn ghost" onClick={() => setPendingImport(null)}>
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  if (!life) {
    return (
      <div className="app center">
        <div className="title-card">
          <div className="sys-window">
            <div className="sys-head">ระบบ</div>
            <p>{soul.lives ? `วิญญาณของคุณผ่านมาแล้ว ${soul.lives} ชาติ — พร้อมเกิดใหม่หรือไม่?` : "ตรวจพบวิญญาณใหม่ — พร้อมเริ่มต้นชีวิตแรกหรือไม่?"}</p>
          </div>
          <div className="section-title">เลือกโลกที่จะเกิด</div>
          {Object.values(WORLDS).map((w) => (
            <button className="path" key={w.id} onClick={() => birth({ worldId: w.id })}>
              <span className="path-title">
                {w.emoji} {w.name}
              </span>
              <span className="path-desc">{w.tagline}</span>
            </button>
          ))}
          <button className="btn primary big" onClick={() => birth({ worldId: pickWorld() })}>
            🎲 สุ่มโลก
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="app">
        <BirthScreen key={life.id} life={life} rerolls={soul.perks.reroll} onReroll={reroll} onStart={() => setStarted(true)} />
      </div>
    );
  }

  if (!life.alive && !resolved) {
    return (
      <div className="app">
        <DeathScreen life={life} soul={soul} lifeNumber={graveyard.length} onSoulChange={commitSoul} onRebirth={onRebirth} />
      </div>
    );
  }

  return (
    <div className={`app ${shake ? "shake" : ""}`}>
      <MainScreen life={life} onAgeUp={onAgeUp} onTab={setTab} />

      {tab && !life.queue.length && !resolved && (
        <Sheet title={TAB_TITLES[tab]} onClose={() => setTab(null)}>
          {tab === "career" && <CareerTab life={life} act={act} />}
          {tab === "people" && <PeopleTab life={life} act={act} />}
          {tab === "power" && <PowerTab life={life} act={act} />}
          {tab === "activities" && <ActivitiesTab life={life} act={act} />}
          {tab === "soul" && (
            <SoulTab
              life={life}
              soul={soul}
              graveyard={graveyard}
              dev={DEV}
              act={act}
              onNewLife={async (opts) => {
                await clearCurrent();
                // ปุ่ม "เริ่มชีวิตใหม่" กลับไปหน้าเลือกโลก · Admin สร้างตัวละครได้ทันที
                if (opts) birth(opts);
                else {
                  setTab(null);
                  setLife(null);
                }
              }}
              onImport={setPendingImport}
            />
          )}
        </Sheet>
      )}

      {resolved ? (
        <OutcomeModal resolved={resolved} onNext={() => setResolved(null)} />
      ) : (
        life.queue.length > 0 && <EventModal life={life} onChoose={onChoose} />
      )}

      {toast && <div className={`toast ${toast.kind ?? ""}`}>{toast.text}</div>}
    </div>
  );
}

const TAB_TITLES: Record<TabId, string> = {
  career: "การเรียน & อาชีพ",
  people: "ความสัมพันธ์",
  power: "พลัง",
  activities: "กิจกรรม",
  soul: "วิญญาณ",
};
