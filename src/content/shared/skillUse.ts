// ใช้สกิลในฉากจริง: ทุกฉากต่อสู้ที่เสี่ยงตายจะมีตัวเลือก "ใช้「สกิล」" เพิ่มเข้ามา
// ใช้ได้ปีละครั้งต่อสกิล · ยิ่งใช้ยิ่งชำนาญ · สกิลรักษาฟื้นสุขภาพทุกปี
import { sceneExtras, type Choice, type Ctx, type Scene } from "../../engine/events";
import { yearHooks } from "../../engine/game";
import type { Life } from "../../engine/types";
import { addStat, checkChance } from "../../engine/util";
import { skillsOf } from "../hunter/power";
import { SKILL_TYPE, masteryOf } from "../skills";

/** ให้ fightOdds/survivalOdds เห็นโบนัสของสกิลระหว่างคำนวณ */
function withBoost<T>(l: Life, boost: number, fn: () => T): T {
  l.flags.skillBoost = boost;
  try {
    return fn();
  } finally {
    delete l.flags.skillBoost;
  }
}

function baseOdds(l: Life, c: Choice, ctx: Ctx, boost: number): number {
  if (c.odds) return withBoost(l, boost, () => c.odds!(l, ctx));
  if (c.check) return checkChance(l, c.check.stat, c.check.dc, c.check.bonus?.(l, ctx) ?? 0) + boost;
  return 1;
}

/** ตัวเลือกหลักของฉากที่สกิลเสริมได้ + แท็กของฉาก
 *  1) ตัวเลือกที่ประกาศแท็กไว้เอง  2) ตัวเลือกเสี่ยงตายที่มี % = ฉากต่อสู้ */
function baseChoice(l: Life, scene: Scene, ctx: Ctx): { c: Choice; tags: string[] } | undefined {
  const visible = scene.choices.filter((c) => !c.show || c.show(l, ctx));
  const tagged = visible.find((c) => c.skill && (c.odds || c.check));
  if (tagged) return { c: tagged, tags: typeof tagged.skill === "function" ? tagged.skill(l, ctx) : tagged.skill! };
  const fight = visible.find((c) => c.tone === "danger" && c.odds);
  return fight && { c: fight, tags: ["combat"] };
}

export const skillReady = (l: Life, name: string) => !l.doneThisYear.includes(`skill:${name}`);

sceneExtras.push((l, scene, ctx) => {
  if (!l.alive || !skillsOf(l).length) return [];
  const found = baseChoice(l, scene, ctx);
  if (!found) return [];
  const base = found.c;
  const ready = skillsOf(l)
    .filter((s) => skillReady(l, s.name) && s.tags.some((t) => found.tags.includes(t)))
    .sort((a, b) => b.boost - a.boost)
    .slice(0, 2);
  return ready.map(
    (s): Choice => ({
      label: `${SKILL_TYPE[s.type].emoji} ใช้「${s.name}」`,
      tone: "special",
      show: base.show,
      odds: (l2, c2) => baseOdds(l2, base, c2, s.boost),
      survival: base.survival && ((l2, c2) => withBoost(l2, s.boost, () => base.survival!(l2, c2))),
      run: (l2, c2, ok) => {
        l2.doneThisYear.push(`skill:${s.name}`);
        const p = l2.power;
        const before = masteryOf(l2, s.name);
        if (p) p.mastery = { ...p.mastery, [s.name]: (p.mastery?.[s.name] ?? 0) + 1 };
        else l2.flags[`mastery_${s.name}`] = Number(l2.flags[`mastery_${s.name}`] ?? 0) + 1;
        const out = withBoost(l2, s.boost, () => base.run(l2, c2, ok));
        const after = masteryOf(l2, s.name);
        const up = after > before ? ` (ความชำนาญ「${s.name}」เพิ่มเป็น Lv.${after})` : "";
        return { ...out, text: `คุณใช้「${s.name}」 — ${out.text}${up}` };
      },
    }),
  );
});

// สกิลสายรักษาฟื้นฟูร่างกายทุกปี
yearHooks.push((l) => {
  const regen = skillsOf(l).reduce((s, x) => s + x.regen, 0);
  if (regen) addStat(l, "health", Math.min(4, regen));
});
