import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { CULTURES, UPRISING_AT, classOf, cultureOf, favorNeed, godOfKingdom, repsOf, societyLines } from "../content/fantasy/society2";
import { throneOf } from "../content/fantasy/realm";
import { fl, homeKingdom, kingdomsOf } from "../content/fantasy/state";
import { careerById } from "../content/core/careers";
import { doActivity } from "./activities";
import { currentScene, getEvent, labelOf } from "./events";
import { createLife, jobChance, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const labels = (l: Life) => { const q = l.queue[0]; const s = currentScene(q, l)!; return s.choices.filter((c) => !c.show || c.show(l, q.ctx)).map((c) => labelOf(c, l, q.ctx)); };
const pickRun = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0], s = currentScene(q, l)!;
  const c = s.choices.find((x) => (!x.show || x.show(l, q.ctx)) && re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no choice ${re} in ${q.eventId}/${q.scene ?? "start"}: ${labels(l).join(" | ")}`);
  const out = c.run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};
const only = (l: Life, id: string) => { l.queue = l.queue.filter((q) => q.eventId === id); };

describe("แผ่นดิน ชนชั้น และชื่อเสียง", () => {
  it("แต่ละแผ่นดินมีวัฒนธรรมและเทพของตัวเอง และงานที่ตรงวัฒนธรรมสมัครง่ายกว่า", () => {
    const l = life(1);
    const ks = kingdomsOf(l);
    expect(new Set(ks.map(cultureOf)).size).toBeGreaterThan(1);
    expect(godOfKingdom(ks[0])).toBeTruthy();
    const k = homeKingdom(l), v = cultureOf(k);
    const fit = CULTURES[v].fams[0];
    const fitJob = ({ arms: "ft_soldier", court: "ft_scribe", trade: "ft_merchant", travel: "ft_sailor", craft: "ft_smith", faith: "ft_healer", magic: "ft_scholar", arts: "ft_painter" } as Record<string, string>)[fit];
    const other = kingdomsOf(l).find((x) => cultureOf(x) !== v)!;
    l.stats.smarts = 60; l.stats.health = 60; l.stats.looks = 60;
    const here = jobChance(l, careerById(fitJob)!);
    fl(l).kingdom = other.id;
    expect(here).toBeGreaterThan(jobChance(l, careerById(fitJob)!));
  });
  it("ชนชั้นปีนได้ด้วยเงินและตำแหน่ง", () => {
    const l = life(2); l.wealth = "middle"; l.money = 1000; l.fame = 0;
    expect(classOf(l)).toBe(1);
    l.money = 400 * 100;
    expect(classOf(l)).toBe(2);
    fl(l).court = { rank: 3, favor: 0 };
    expect(classOf(l)).toBe(4);
  });
  it("ชื่อเสียงมีหลายด้าน และเปลี่ยนตามสิ่งที่ทำ", () => {
    const l = life(3);
    const r0 = repsOf(l);
    fl(l).kills = 3;
    expect(repsOf(l).cruelty).toBeGreaterThan(r0.cruelty);
    expect(societyLines(l).some((t) => /ชื่อเสียง: เกียรติ/.test(t))).toBe(true);
  });
});

describe("ราชสำนักและบัลลังก์", () => {
  it("เข้าเฝ้าแล้วได้ความโปรดปรานจนได้ตำแหน่ง และขั้นสูงสุดอาจได้สืบบัลลังก์", () => {
    const l = life(4); l.money = 1_000_000;
    for (let i = 0; i < 30 && (fl(l).court?.rank ?? 0) < 4; i++) { l.doneThisYear = []; l.flags.ftCourtAt = -1; doActivity(l, "ft_court"); only(l, "ft.so.court"); pickRun(l, /ถวายของขวัญ/); }
    expect(fl(l).court!.rank).toBe(4);
    expect(favorNeed(1)).toBeGreaterThan(favorNeed(0));
    homeKingdom(l).playerRuled = false;
    expect(getEvent("ft.so.regent")!.when!(l)).toBe(true);
    runEvent(l, "ft.so.regent"); pickRun(l, /รับมงกุฎ/);
    expect(throneOf(l)).toBeTruthy();
  });
  it("ผู้ครองต้องตัดสินเรื่องของแผ่นดินทุกปี และผลเปลี่ยนกำลังของแผ่นดิน", () => {
    const l = life(5); l.money = 1_000_000;
    fl(l).court = { rank: 4, favor: 0 }; homeKingdom(l).playerRuled = false;
    runEvent(l, "ft.so.regent"); pickRun(l, /รับมงกุฎ/);
    const k = throneOf(l)!;
    expect(getEvent("ft.so.rule")!.when!(l)).toBe(true);
    runEvent(l, "ft.so.rule", { is: 0 });
    const s0 = k.stability;
    pickRun(l, /เปิดยุ้งฉาง/);
    expect(k.stability).toBeGreaterThan(s0);
    expect(getEvent("ft.so.rule")!.when!(l)).toBe(false);
  });
});

describe("ศรัทธา", () => {
  it("อุทิศตนให้เทพแล้วมีหน้าที่ ละเลยหน้าที่แล้วพรหาย", () => {
    const l = life(6);
    doActivity(l, "ft_devote"); only(l, "ft.so.devote"); pickRun(l, /ซอเลีย|การ์โรธ|มีร่า|อัลเวน|เวอร์ดา/);
    expect(fl(l).god).toBeTruthy();
    l.age += 4;
    expect(getEvent("ft.so.duty")!.when!(l)).toBe(true);
    runEvent(l, "ft.so.duty"); pickRun(l, /ขอเว้น/);
    expect(fl(l).godLost).toBe(l.age);
    expect(societyLines(l).some((t) => /พรหายไป/.test(t))).toBe(true);
  });
  it("แผ่นดินแห่งศรัทธาล่าคนที่บูชาเทพอื่น", () => {
    const l = life(7);
    const k = kingdomsOf(l).find((x) => cultureOf(x) === "faith");
    if (!k) return;
    fl(l).kingdom = k.id;
    fl(l).god = ["solia", "garroth", "myra", "alven", "verda"].find((g) => g !== godOfKingdom(k).id);
    expect(getEvent("ft.so.heresy")!.when!(l)).toBe(true);
    runEvent(l, "ft.so.heresy"); pickRun(l, /เปลี่ยนมาบูชา/);
    expect(fl(l).god).toBe(godOfKingdom(k).id);
  });
});

describe("สมาคมลับและกบฏ", () => {
  it("วงเงาเชิญเข้าวง ทำงานจนเข้าวงใน แล้วต้องเลือกว่าจะทำอย่างไรกับบัลลังก์", () => {
    const l = life(8); l.stats.smarts = 80;
    runEvent(l, "ft.so.secret"); pickRun(l, /ไปตามนัด/);
    for (let i = 0; i < 6; i++) { runEvent(l, "ft.so.secret_job"); pickRun(l, /ทำงานให้สำเร็จ/, true); }
    expect(fl(l).shadow!.rank).toBe(3);
    expect(getEvent("ft.so.secret_plot")!.when!(l)).toBe(true);
    runEvent(l, "ft.so.secret_plot"); pickRun(l, /หักหลัง/);
    expect(fl(l).deeds.some((d) => d.includes("วงเงา"))).toBe(true);
  });
  it("แผ่นดินที่ไม่มั่นคงมีกบฏ ทำงานให้ครบแล้วนำการลุกฮือขึ้นครองได้", () => {
    const l = life(9); const k = homeKingdom(l); k.stability = 20; k.playerRuled = false;
    expect(getEvent("ft.so.rebel")!.when!(l)).toBe(true);
    runEvent(l, "ft.so.rebel"); pickRun(l, /เข้าร่วม/);
    for (let i = 0; i < UPRISING_AT; i++) { runEvent(l, "ft.so.rebel_job"); pickRun(l, /รับงาน/, true); }
    expect(getEvent("ft.so.uprising")!.when!(l)).toBe(true);
    runEvent(l, "ft.so.uprising"); pickRun(l, /นำการบุก/, true);
    expect(throneOf(l)?.id).toBe(k.id);
    expect(fl(l).rebel).toBeUndefined();
  });
});

describe("การเดินทาง", () => {
  it("ย้ายแผ่นดินเป็นการเดินทาง: เห็นวัฒนธรรม ภาษี เทพ แล้วเลือกทางไป", () => {
    const l = life(10);
    const home = fl(l).kingdom;
    doActivity(l, "ft_move"); only(l, "ft.so.journey");
    expect(labels(l).some((t) => /ภาษี \d+%/.test(t))).toBe(true);
    pickRun(l, /^[^ย]/);
    expect(l.queue[0].scene).toBe("how");
    const out = pickRun(l, /ทางบก/, true);
    expect(fl(l).kingdom).not.toBe(home);
    expect(out.text).toMatch(/แผ่นดินแห่ง/);
  });
});
