import { describe, expect, it } from "vitest";
import { FANTASY_START_YEAR, loadFantasyWorld, newFantasyWorld, rememberLife, strangerBirth } from "../content/fantasy";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { isOpenWorld, worldOf } from "../content/worlds";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { displayName } from "./util";
import { applySoul, claimAward, newSoul } from "./soul";
import { validateLife } from "./validate";
import { moduleOf, traitsOf } from "./worldModule";
import { advanceWorld, recordChronicle } from "./worldState";

loadMurimWorld();
loadFantasyWorld();
loadSharedEvents();

const live = (l: Life, years = 140) => {
  const r = { rng: l.seed };
  for (let i = 0; i < years && l.alive; i++) {
    ageUp(l);
    let g = 0;
    while (l.queue.length && g++ < 40) {
      const o = visibleChoices(l, l.queue[0]);
      expect(o.length, l.queue[0].eventId).toBeGreaterThan(0);
      resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
    }
  }
  return l;
};

describe("Milestone 0", () => {
  it("แต่ละโลกลงทะเบียนโมดูลของตัวเอง", () => {
    expect(moduleOf("murim")?.gift).toBeTruthy();
    expect(moduleOf("fantasy")?.gift).toBeUndefined();
    expect(traitsOf("murim").surnameFirst).toBe(true);
    expect(traitsOf("fantasy").surnameFirst).toBe(false);
    expect(traitsOf("deleted-world")).toEqual({});
  });

  it("ชีวิตในโลกแฟนตาซีเปล่าเล่นจนจบได้ ไม่พัง ไม่มีเหตุการณ์ชุดเก่าปน", () => {
    for (let s = 1; s <= 30; s++) {
      const l = createLife({ seed: s * 101, worldId: "fantasy" });
      expect(l.worldId).toBe("fantasy");
      expect(worldOf(l.worldId).id).toBe("fantasy");
      live(l);
      expect(l.alive).toBe(false);
      expect(validateLife(l)).toEqual([]);
      expect(l.mw).toBeUndefined();
      expect(Object.keys(l.seen)).toEqual([]);
    }
  });

  it("ชื่อคนในโลกแฟนตาซีไม่ใช้รูปแบบแซ่นำหน้า", () => {
    const l = createLife({ seed: 7, worldId: "fantasy" });
    expect(displayName(l)).toBe(`${l.firstName} ${l.lastName}`);
    const m = createLife({ seed: 7, worldId: "murim" });
    expect(displayName(m)).toBe(`${m.lastName}${m.firstName}`);
  });

  it("โลกอยู่ต่อหลังตัวละครตาย และตัวละครใหม่เกิดหลายสิบปีต่อมาพร้อมเจอตำนานคนเก่า", () => {
    const w = newFantasyWorld(1);
    const a = live(createLife({ seed: 11, worldId: "fantasy" }));
    a.fame = 80;
    rememberLife(w, a);
    expect(w.legends[0].name).toBe(displayName(a));
    const year = strangerBirth(w, 40);
    expect(year).toBe(FANTASY_START_YEAR + 40);
    const b = createLife({ seed: 12, worldId: "fantasy", birthYear: year });
    expect(b.birthYear).toBe(year);
    expect(w.legends[0].name).not.toBe(displayName(b));
    expect(w.legends[0].retold).toBe(4);
    expect(structuredClone(w)).toEqual(w);
  });

  it("คนธรรมดาไม่กลายเป็นตำนาน", () => {
    const w = newFantasyWorld(2);
    const a = live(createLife({ seed: 13, worldId: "fantasy" }));
    a.fame = 5;
    rememberLife(w, a);
    expect(w.legends).toEqual([]);
    expect(w.chronicle.length).toBe(1);
  });

  it("บันทึกโลกมีเพดาน เซฟไม่โตไม่สิ้นสุด", () => {
    const w = newFantasyWorld(3);
    for (let i = 0; i < 1000; i++) recordChronicle(w, `ปีที่ ${i}`);
    expect(w.chronicle.length).toBe(400);
    expect(w.chronicle.at(-1)!.text).toBe("ปีที่ 999");
  });

  it("เดินเวลาโลกเรียก tick ทุกปี ผลลัพธ์ซ้ำได้จาก seed เดิม", () => {
    const run = () => {
      const w = newFantasyWorld(4);
      let n = 0;
      advanceWorld(w, 50, () => n++);
      return { n, year: w.year };
    };
    expect(run()).toEqual({ n: 50, year: FANTASY_START_YEAR + 50 });
    expect(run()).toEqual(run());
  });

  it("วิญญาณใช้กับตัวละครแฟนตาซีได้ ไม่พังเพราะตารางเก่าของยุทธภพ", () => {
    const soul = newSoul();
    const l = createLife({ seed: 21, worldId: "fantasy" });
    applySoul(l, soul, true);
    live(l);
    claimAward(soul, l, false);
    expect(soul.lives).toBeGreaterThanOrEqual(0);
  });

  it("โลกแฟนตาซียังไม่เปิดให้ผู้เล่นทั่วไป", () => {
    expect(isOpenWorld("fantasy")).toBe(false);
    expect(isOpenWorld("murim")).toBe(true);
  });
});
