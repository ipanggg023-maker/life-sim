import { useCallback, useEffect, useRef, useState } from "react";
import { ageUp, createLife, resolveChoice, toPastLife, type BirthOptions } from "../engine/game";
import { currentScene, labelOf, type Outcome } from "../engine/events";
import { buildRegression, claimAward, nextEraOptions, regressTarget } from "../engine/soul";
import type { Life, PastLife, Soul, WorldId } from "../engine/types";
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
import type { Focus } from "../content/shared/focus";

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
  const [busy, setBusy] = useState(false);
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
      feedback(out);
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

  /**
   * อ่านต่อรวดเดียว: เล่นปีที่ไม่มีอะไรสำคัญให้อัตโนมัติ (สูงสุด 15 ปี)
   * หยุดเมื่อมีฉากให้เลือก ตาย เปิดตอน/ภาคใหม่ หรือสุขภาพน่าเป็นห่วง
   */
  const onAutoRead = useCallback(async () => {
    if (!life || busy) return;
    setBusy(true);
    try {
      for (let i = 0; i < 15; i++) {
        await saveSnapshot(life);
        const from = life.log.length;
        ageUp(life);
        if (!life.alive || life.queue.length) break;
        const fresh = life.log.slice(from);
        if (fresh.some((e) => e.kind === "chapter" || e.kind === "arc" || e.kind === "milestone" || e.kind === "comments")) break;
        if (life.stats.health < 25) break;
        // ให้หน้าจอได้เห็นปีที่ผ่านไปทีละนิด
        setLife({ ...life });
        await new Promise((r) => setTimeout(r, 90));
      }
    } finally {
      setBusy(false);
      await commit(life);
    }
  }, [life, busy, commit]);

  const onFocus = useCallback(
    (f: Focus | undefined) => {
      if (!life) return;
      if (f) life.flags.focus = f;
      else delete life.flags.focus;
      commit(life);
    },
    [life, commit],
  );

  const onChoose = useCallback(
    (index: number) => {
      if (!life) return;
      const q = life.queue[0];
      const scene = currentScene(q)!;
      const prompt = scene.text(life, q.ctx);
      const choice = labelOf(scene.choices[index], life, q.ctx);
      const out = resolveChoice(life, index);
      if (out) {
        setResolved({ title: scene.title, prompt, choice, out });
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
      // เส้นเวลาใหม่: สุ่มโลกจากโลกที่ปลดล็อกแล้ว (ยุทธภพปลดล็อกหลังตายครั้งแรก)
      const worlds: WorldId[] = ["hunter", "murim", "court"];
      await birth(choice === "nextEra" ? { ...nextEraOptions(life), worldId: life.worldId } : { worldId: worlds[Math.floor(Math.random() * worlds.length)] });
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
          <button className="btn primary big" onClick={() => birth()}>
            เกิด
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
      <MainScreen life={life} busy={busy} onAgeUp={onAgeUp} onAutoRead={onAutoRead} onFocus={onFocus} onTab={setTab} />

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
                birth(opts);
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
