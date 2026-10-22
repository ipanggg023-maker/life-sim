import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { murimDeathCause } from "../content/murim/life/deathCause";
import { calYear, worldOfLife } from "../content/murim/life/world";
import { courtsOf } from "../content/murim/world/kingdomCourt";
import type { Kingdom } from "../content/murim/world/war";
import { injure, treat } from "./body";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }, prefer?: string) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const i = prefer ? o.findIndex((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith(prefer)) : -1;
    resolveChoice(l, o[i >= 0 ? i : Math.floor(nextFloat(r) * o.length)].index);
  }
}

const THREE = (): Kingdom[] => [
  { id: "north", name: "แคว้นจิ้นเหนือ", lord: "เฉาเจิ้นอวี่", power: 45, trait: "เหี้ยม" },
  { id: "west", name: "แคว้นซูตะวันตก", lord: "หลิวอันเหริน", power: 30, trait: "ใจกว้าง" },
  { id: "south", name: "แคว้นหลินใต้", lord: "ซุนเหยาหมิง", power: 35, trait: "ระวังตัว" },
];
function warLife(seed: number) {
  const l = createLife({ seed, worldId: "murim" });
  const w = worldOfLife(l);
  l.age = 22;
  l.stats.health = 95;
  w.era = "war";
  w.eraSince = calYear(l);
  w.kingdoms = THREE();
  return l;
}

describe("สาเหตุการตายตามจริง · สามแคว้นมีราชสำนัก · เรื่องตามยุคสมัย", () => {
  it("คนที่ไม่เคยโดนพิษไม่ตายด้วยพิษสะสม · คนไม่ฝึกลมปราณไม่ตายเพราะลมปราณแตกซ่าน", () => {
    let deaths = 0;
    for (let s = 1; s <= 120; s++) {
      const l = createLife({ seed: s * 7919, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s };
      for (let g = 0; g < 130 && l.alive; g++) { drain(l, r); if (l.alive) ageUp(l); }
      if (l.alive) continue;
      deaths++;
      const c = l.causeOfDeath ?? "";
      if (/สะสมในร่างกาย/.test(c)) expect(l.body?.injuries.some((i) => i.kind === "poison"), c).toBe(true);
      if (/ลมปราณแตกซ่าน|ธาตุไฟ/.test(c)) expect(l.power, c).toBeTruthy();
    }
    expect(deaths).toBeGreaterThan(100);
    // คนที่มีพิษในเลือดจริง ตายแล้วสาเหตุบอกว่าพิษ
    const p = createLife({ seed: 3, worldId: "murim" });
    p.age = 40;
    injure(p, "blood", "poison", 2, "เข็มพิษของตระกูลถัง");
    if (p.body?.injuries.length) expect(murimDeathCause(p)).toMatch(/พิษจากเข็มพิษของตระกูลถัง/);
    const q = createLife({ seed: 4, worldId: "murim" });
    q.age = 30; q.stats.health = 90;
    expect(murimDeathCause(q) ?? "").not.toMatch(/พิษ.*สะสม/);
  });

  it("หมอเทวดาขับพิษถาวรออกได้", () => {
    let cured = 0;
    for (let s = 1; s <= 30; s++) {
      const l = createLife({ seed: s, worldId: "murim" });
      injure(l, "blood", "poison", 3, "พิษงู");
      if (!l.body?.injuries.length) continue;
      if (treat(l, 2).ok && !l.body.injuries.some((i) => i.kind === "poison")) cured++;
    }
    expect(cured).toBeGreaterThan(5);
  });

  it("สามแคว้นมีราชสำนัก: เจ้าแคว้นแก่ลงและสิ้นใจ รัชทายาทขึ้นแทน ขุนพลเปลี่ยน ข่าวศึก แคว้นล่มสลาย จนรวมแผ่นดิน", () => {
    let successions = 0, fallen = 0, unified = 0, kcSeen = 0, news = 0;
    for (let s = 1; s <= 40; s++) {
      const l = warLife(2000 + s * 31);
      const r = { rng: s };
      runEvent(l, "mw.war.recruit");
      drain(l, r, s % 3 === 0 ? "ไปกับแคว้นจิ้นเหนือ" : s % 3 === 1 ? "ไปกับแคว้นซูตะวันตก" : "ไปกับแคว้นหลินใต้");
      expect(l.flags.lord).toBeTruthy();
      const lords0 = courtsOf(l).map((k) => k.lord);
      for (let y = 0; y < 30 && l.alive && l.mw!.era === "war"; y++) {
        l.stats.health = Math.max(l.stats.health, 70);
        ageUp(l);
        drain(l, r);
        expect(validateLife(l)).toEqual([]);
        const ks = courtsOf(l);
        if (ks.length) {
          news = Math.max(news, ks.reduce((n, k) => n + (k.news?.length ?? 0), 0));
          for (const k of ks) { expect(k.capital).toBeTruthy(); expect(k.strategist).toBeTruthy(); expect(k.general).toBeTruthy(); }
          if (ks.some((k, i) => k.lord !== lords0[i])) successions++;
          if (ks.some((k) => k.fallen)) fallen++;
        }
      }
      if (l.mw!.era !== "war") unified++;
      kcSeen += Object.keys(l.seen).filter((k) => k.startsWith("mw.kc.")).length;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM kingdoms", { successions, fallen, unified, kcSeen, news });
    expect(successions).toBeGreaterThan(5);
    expect(unified).toBeGreaterThan(10);
    expect(kcSeen).toBeGreaterThan(10);
    expect(news).toBeGreaterThan(0);
    expect(fallen).toBeGreaterThan(0);
  });

  it("เจ้าแคว้นสิ้นใจ: ถวายสัตย์ / หนุนท่านอาชิงบัลลังก์ / ลาออก · เมืองหลวงแตก: ยอมจำนน", () => {
    const l = warLife(77);
    l.flags.lord = "west"; l.flags.warRole = "officer"; l.flags.warRank = 3; l.flags.lordFavor = 60;
    const k = courtsOf(l).find((x) => x.id === "west")!;
    k.lordAge = 200;
    ageUp(l);
    expect(l.flags.lordDied === "west" || l.seen["mw.kc.new_lord"]).toBeTruthy();
    drain(l, { rng: 1 }, "คุกเข่าถวายสัตย์");
    expect(l.flags.lordDied).toBeUndefined();
    expect(courtsOf(l).find((x) => x.id === "west")!.lord).not.toBe("หลิวอันเหริน");

    const m = warLife(78);
    m.flags.lord = "west"; m.flags.warRole = "officer"; m.flags.lordFavor = 50;
    const ks = courtsOf(m);
    ks.find((x) => x.id === "west")!.power = 5;
    ks.find((x) => x.id === "north")!.power = 90;
    m.mw!.eraSince = calYear(m) - 6;
    for (let i = 0; i < 12 && !m.seen["mw.kc.fall"] && m.alive; i++) { ks.find((x) => x.id === "west")!.power = 5; m.stats.health = 90; ageUp(m); if (m.flags.lordFell) drain(m, { rng: 2 }, "ยอมจำนน"); else drain(m, { rng: 2 }); }
    expect(m.seen["mw.kc.fall"]).toBeTruthy();
    expect(courtsOf(m).find((x) => x.id === "west")!.fallen).toBeTruthy();
    if (m.alive && m.mw!.era === "war") expect(m.flags.lord).toBe("north");
  });

  it("แม่ทัพที่ชิงลงมือยึดเมืองหลวงได้ เป็นเจ้าแคว้น — ถ้ารวมแผ่นดินได้ก็ขึ้นเป็นฮ่องเต้", () => {
    let won = 0;
    for (let s = 1; s <= 60 && !won; s++) {
      const l = warLife(500 + s);
      l.flags.lord = "north"; l.flags.warRole = "general"; l.flags.warRank = 8; l.flags.lordFavor = 5; l.fame = 80;
      l.power = { rank: 6, hunterClass: "m_sword", level: 60, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
      runEvent(l, "mw.kc.suspicion");
      drain(l, { rng: s }, "ชิงลงมือก่อน");
      if (!l.flags.isLord) continue;
      won++;
      expect(courtsOf(l).find((k) => k.id === "north")!.lord).toContain(l.firstName);
      for (const k of courtsOf(l)) if (k.id !== "north") k.power = 5;
      courtsOf(l).find((k) => k.id === "north")!.power = 95;
      l.mw!.eraSince = calYear(l) - 20;
      for (let y = 0; y < 30 && l.alive && l.mw!.era === "war"; y++) { l.stats.health = 95; ageUp(l); drain(l, { rng: s }); }
      if (l.alive && l.mw!.era !== "war") expect(l.flags.emperorSelf).toBe(true);
    }
    expect(won).toBeGreaterThan(0);
  });

  it("เรื่องตามยุค: ทุกเรื่องเกิดได้ในยุคของมัน และไม่เกิดผิดยุค", () => {
    const eras = { pe: ["peace"], de: ["decline"], ch: ["chaos"], wr: ["war"], rc: ["recovery"] } as const;
    for (const [tag, [era]] of Object.entries(eras)) {
      const l = createLife({ seed: 9, worldId: "murim" });
      const w = worldOfLife(l);
      w.era = era as never;
      if (era === "war") w.kingdoms = THREE();
      const other = createLife({ seed: 9, worldId: "murim" });
      worldOfLife(other).era = (era === "peace" ? "chaos" : "peace") as never;
      const evs = ["pe.lantern", "pe.harvest", "de.tax", "de.toll", "ch.refugees", "ch.bodies", "wr.border", "wr.coins", "rc.return", "rc.deed"].filter((x) => x.startsWith(tag));
      for (const id of evs) {
        const e = getEvent(`er.${id}`)!;
        expect(e, id).toBeTruthy();
        l.age = 30; other.age = 30;
        const ok = (x: Life) => (!e.when || e.when(x)) && (typeof e.weight === "function" ? e.weight(x) > 0 : true);
        expect(ok(l), `${id} ควรเกิดใน ${era}`).toBe(true);
        if (!["de.tax", "de.toll", "ch.refugees", "ch.bodies", "pe.lantern", "pe.harvest"].includes(id)) expect(ok(other), `${id} ไม่ควรเกิดนอกยุค`).toBe(false);
      }
    }
    // ชีวิตสุ่มในแต่ละยุคได้เจอเรื่องของยุคนั้น และเล่นจนจบได้โดยไม่ตัน
    for (const era of ["peace", "decline", "chaos", "recovery"] as const) {
      let met = 0;
      for (let s = 1; s <= 25; s++) {
        const l = createLife({ seed: s * 101, worldId: "murim" });
        const w = worldOfLife(l);
        const r = { rng: s };
        for (let y = 0; y < 50 && l.alive; y++) { w.era = era; drain(l, r); if (l.alive) ageUp(l); }
        met += Object.keys(l.seen).filter((k) => k.startsWith("er.")).length;
        expect(validateLife(l)).toEqual([]);
      }
      console.log("SIM era events", era, met);
      expect(met, era).toBeGreaterThan(5);
    }
  });
});
