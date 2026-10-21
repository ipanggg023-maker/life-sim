import { useCallback, useEffect, useRef, useState } from "react";
import { ageUp, createLife, pastSelfOf, resolveChoice, toPastLife, type BirthOptions } from "../engine/game";
import { currentScene, labelOf, type Outcome } from "../engine/events";
import { buildDisciple, inheritMurim, recordChronicle } from "../content/murim/life/generations";
import { applySoul, buildHeir, buildRegression, claimAward, nextEraOptions, regressTarget } from "../engine/soul";
import type { Life, PastLife, Soul, WorldId } from "../engine/types";
import { loc } from "../engine/util";
import { OPEN_WORLDS, WORLDS, isOpenWorld, isRealistic } from "../content/worlds";

const pickWorld = () => OPEN_WORLDS[Math.floor(Math.random() * OPEN_WORLDS.length)];
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
  saveCurrentSoon,
  saveSnapshot,
  saveSoul,
  updateGraveyardPoints,
  type Bundle,
} from "../save";
import { BirthScreen } from "./BirthScreen";
import { DeathScreen, type RebirthChoice } from "./DeathScreen";
import { buildReport, snapshot } from "../engine/report";
import { cancelUpload, cloudEnabled, currentUser, downloadSave, isGuest, newerInCloud, onAuthChange, scheduleUpload, setGuest, setMark } from "../cloud";
import { LoginScreen } from "./CloudCard";
import { EventModal, OutcomeModal, type Resolved } from "./EventModal";
import { MainScreen, type TabId } from "./MainScreen";
import { Sheet } from "./Sheet";
import { ActivitiesTab } from "./tabs/ActivitiesTab";
import { CareerTab } from "./tabs/CareerTab";
import { PeopleTab } from "./tabs/PeopleTab";
import { PowerTab } from "./tabs/PowerTab";
import { PhoneTab } from "./tabs/PhoneTab";
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
  /** มรดกของยุคก่อน (ใช้ซ้ำตอนสุ่มเกิดใหม่) */
  const prepRef = useRef<((l: Life) => void) | undefined>(undefined);
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

  // บัญชีคลาวด์: ล็อกอินอยู่ → อัปโหลดอัตโนมัติ · คลาวด์มีเซฟใหม่กว่า (เล่นจากอีกเครื่อง) → ถามก่อนโหลดมาแทน
  // undefined = ยังตรวจไม่เสร็จ · null = ยังไม่ล็อกอิน
  const [user, setUser] = useState<string | null | undefined>(cloudEnabled ? undefined : null);
  const [guest, setGuestState] = useState(isGuest);
  useEffect(() => {
    if (!cloudEnabled) return;
    let off = () => {};
    void currentUser().then((u) => setUser(u?.id ?? null), () => setUser(null));
    void onAuthChange((u) => setUser(u?.id ?? null)).then((f) => (off = f));
    return () => off();
  }, []);
  // ตรวจคลาวด์ก่อนเสมอ แล้วค่อยเริ่มอัปโหลด — กันเซฟว่างของเครื่องใหม่ไปทับเซฟจริงบนคลาวด์
  const [cloudChecked, setCloudChecked] = useState<string | null>(null);
  useEffect(() => {
    if (!user || loading) return;
    // ล็อกอินแล้ว: ออกจากระบบครั้งหน้าจะกลับมาที่หน้าเข้าสู่ระบบ
    setGuest(false);
    setGuestState(false);
    let live = true;
    void (async () => {
      const info = await newerInCloud().catch(() => null);
      const r = info ? await downloadSave().catch(() => null) : null;
      if (!live) return;
      if (r) {
        cancelUpload();
        setMark(r.updatedAt); // ถามครั้งเดียว — ถ้าไม่โหลด เซฟเครื่องนี้จะอัปโหลดทับรอบถัดไป
        setPendingImport(r.bundle);
      }
      setCloudChecked(user);
    })();
    return () => { live = false; };
  }, [user, loading]);
  useEffect(() => {
    if (user && cloudChecked === user && soul && !pendingImport) scheduleUpload({ v: 1, soul, life: life ?? undefined, graveyard });
    if (pendingImport) cancelUpload();
  }, [user, cloudChecked, soul, life, graveyard, pendingImport]);

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
    // ตายแล้วบันทึกทันที · ระหว่างเล่นบันทึกแบบรวบ
    if (l.alive) saveCurrentSoon(l);
    else await saveCurrent(l);
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
    async (opts: BirthOptions = {}, prep?: (l: Life) => void) => {
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
      applySoul(l, s, true);
      prep?.(l);
      prepRef.current = prep;
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
    applySoul(l, soul, true);
    prepRef.current?.(l);
    await pruneSnapshots();
    await saveSnapshot(l);
    await commit(l);
  }, [soul, birthOpts, commit, commitSoul]);

  /** เดินเวลา n ปี — หยุดทันทีเมื่อมีเรื่องให้ตัดสินใจหรือเสียชีวิต แล้วสรุปผลรวมของช่วงนั้น */
  const onAgeUp = useCallback(
    async (years = 1) => {
      if (!life) return;
      const before = snapshot(life);
      for (let i = 0; i < years; i++) {
        if (!isRealistic(life.worldId)) void saveSnapshot(life); // จุดที่ย้อนเวลากลับมาได้ (โลกที่มีการย้อนเวลา)
        ageUp(life);
        if (!life.alive || life.queue.length) break;
      }
      life.report = buildReport(life, before);
      commit(life);
      if (life.log[life.log.length - 1]?.kind === "bad") flash();
    },
    [life, commit, flash],
  );

  const onChoose = useCallback(
    (index: number) => {
      if (!life) return;
      const q = life.queue[0];
      const scene = currentScene(q, life)!;
      const prompt = loc(life, scene.text(life, q.ctx));
      const choice = loc(life, labelOf(scene.choices[index], life, q.ctx));
      const out = resolveChoice(life, index);
      if (out) {
        const kind = out.kind === "system" && isRealistic(life.worldId) ? "good" : out.kind;
        setResolved({ title: scene.title, prompt, choice, out: { ...out, kind, text: loc(life, out.text) } });
        if (out.kind === "bad") flash();
      }
      commit(life);
    },
    [life, commit, flash],
  );

  const onRebirth = useCallback(
    async (choice: RebirthChoice) => {
      if (!life || !soul) return;
      recordChronicle(soul, life);
      const gained = claimAward(soul, life, choice === "regress");
      await commitSoul(soul);
      setGraveyard(await updateGraveyardPoints(life.id, gained));
      if (choice === "regress") {
        const snap = await loadSnapshot(life.id, regressTarget(life));
        const next = buildRegression(life, snap, soul.perks.clarity);
        applySoul(next, soul, false);
        await pruneSnapshots();
        setTab(null);
        setStarted(true);
        await commit(next);
        return;
      }
      await clearCurrent();
      if (choice.startsWith("heir:") || choice.startsWith("disciple:")) {
        // ภาคต่อ: เล่นต่อเป็นลูก/ศิษย์ — เริ่มทันทีโดยไม่ผ่านหน้าสุ่มเกิด
        const pid = choice.slice(choice.indexOf(":") + 1);
        let next: Life;
        if (choice.startsWith("disciple:")) next = buildDisciple(life, pid);
        else {
          next = buildHeir(life, pid);
          inheritMurim(life, next, "heir", pid);
        }
        applySoul(next, soul, true);
        await clearCurrent();
        await pruneSnapshots();
        await saveSnapshot(next);
        setTab(null);
        setStarted(true);
        await commit(next);
        return;
      }
      if (choice === "nextEra") {
        await birth({ ...nextEraOptions(life), worldId: life.worldId }, (l) => inheritMurim(life, l, "era"));
        return;
      }
      // เส้นเวลาใหม่: ผู้เล่นเลือกโลกเอง — ข้ามโลกได้ฟรี วิญญาณพาความทรงจำไปด้วย
      const w = choice.slice(6) as WorldId;
      // โลกสมจริงไม่มีความทรงจำข้ามชาติ
      await birth({ worldId: w, pastLife: isRealistic(w) ? undefined : pastSelfOf(life) });
    },
    [life, soul, birth, commit, commitSoul],
  );

  if (loading || !soul || user === undefined) return <div className="app center">กำลังโหลด…</div>;

  // หน้าเข้าสู่ระบบ: ก่อนเข้าเกมทุกครั้ง จนกว่าจะล็อกอินหรือเลือกเล่นแบบไม่มีบัญชี
  if (cloudEnabled && !user && !guest) {
    return (
      <div className="app center">
        <LoginScreen
          onGuest={() => {
            setGuest(true);
            setGuestState(true);
          }}
        />
      </div>
    );
  }

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
          <h1 className="login-title">ชีวิตนับร้อยชาติ</h1>
          <p className="muted">{soul.lives ? `ผ่านมาแล้ว ${soul.lives} ชีวิต — พร้อมเริ่มชีวิตใหม่หรือไม่?` : "พร้อมเริ่มต้นชีวิตแรกหรือไม่?"}</p>
          <div className="section-title">เลือกโลกที่จะเกิด</div>
          {Object.values(WORLDS).map((w) => {
            const open = isOpenWorld(w.id);
            return (
              <button className={`path ${open ? "" : "locked"}`} key={w.id} disabled={!open} onClick={() => birth({ worldId: w.id })}>
                <span className="path-title">
                  {w.emoji} {w.name}
                  {!open && " · 🔒 เร็วๆ นี้"}
                </span>
                <span className="path-desc">{open ? w.tagline : "กำลังสร้างใหม่ให้สมจริง จะเปิดทีละโลก"}</span>
              </button>
            );
          })}
          <button className="btn primary big" onClick={() => birth({ worldId: pickWorld() })}>
            เริ่มชีวิตใหม่
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
        <Sheet title={isRealistic(life.worldId) && tab === "soul" ? "บันทึก" : isRealistic(life.worldId) && tab === "power" ? "วิชายุทธ์" : TAB_TITLES[tab]} onClose={() => setTab(null)}>
          {tab === "career" && <CareerTab life={life} act={act} />}
          {tab === "people" && <PeopleTab life={life} act={act} />}
          {tab === "power" && <PowerTab life={life} act={act} />}
          {tab === "activities" && <ActivitiesTab life={life} act={act} />}
          {tab === "phone" && <PhoneTab life={life} act={act} />}
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
  phone: "มือถือ",
  soul: "วิญญาณ",
};
