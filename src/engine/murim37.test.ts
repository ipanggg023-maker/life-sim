import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { startWarEra } from "../content/murim/world/war";
import { worldOfLife } from "../content/murim/life/world";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function live(seed: number, years: number, r: { rng: number }, prep?: (l: Life) => void) {
  const l = createLife({ seed, worldId: "murim" });
  prep?.(l);
  const seen: string[] = [];
  for (let y = 0; y < years && l.alive; y++) {
    l.stats.health = Math.max(l.stats.health, 55);
    ageUp(l);
    let g = 0;
    while (l.queue.length && g++ < 80) {
      seen.push(l.queue[0].eventId);
      const o = visibleChoices(l, l.queue[0]);
      expect(o.length, l.queue[0].eventId).toBeGreaterThan(0);
      resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
    }
  }
  return { l, seen };
}

describe("จุดเปลี่ยนชีวิตแบบมังฮวา สามก๊ก หนังจีน — เปิดให้ทุกชีวิต ไม่ต้องเลือกแนว", () => {
  it("ชีวิตธรรมดาเจอเด็กที่ถูกมองข้าม คืนฟ้าผ่า และโรงเตี๊ยมคืนพายุได้ · ผสมกันได้ในชีวิตเดียว", () => {
    const r = { rng: 9 };
    let overlooked = 0, turn = 0, inn = 0, mixed = 0;
    for (let i = 1; i <= 40; i++) {
      const { seen } = live(4000 + i, 45, r);
      const a = seen.includes("fv.mh.overlooked"), b = seen.includes("fv.mh.turn"), c = seen.includes("fv.fm.inn");
      overlooked += Number(a); turn += Number(b); inn += Number(c);
      if ((a || b) && c) mixed++;
    }
    console.log("TURNING", { overlooked, turn, inn, mixed });
    expect(overlooked).toBeGreaterThan(5);
    expect(turn).toBeGreaterThan(3);
    expect(inn).toBeGreaterThan(5);
    expect(mixed).toBeGreaterThan(0);
  });

  it("คนที่เกิดในยุคสามแคว้นเจอเมืองถูกล้อมและคำสาบานใต้ต้นท้อ", () => {
    const r = { rng: 3 };
    let siege = 0, oath = 0;
    for (let i = 1; i <= 25; i++) {
      const { seen } = live(5000 + i, 25, r, (l) => { worldOfLife(l); startWarEra(l); });
      siege += Number(seen.includes("fv.tk.siege"));
      oath += Number(seen.includes("fv.tk.oath"));
    }
    console.log("WAR-BORN", { siege, oath });
    expect(siege).toBeGreaterThan(8);
    expect(oath).toBeGreaterThan(3);
  });
});
