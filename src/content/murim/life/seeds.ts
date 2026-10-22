// ผลที่ตามมาหลายสิบปี: เมล็ดที่ปลูกไว้ (seedStore.ts) สุกเป็นเรื่องราวเมื่อถึงเวลา
// ไว้ชีวิต → กลับมาตอบแทนหรือทวงคืน · ฆ่าคน → ลูกของเขาโตมาตามหา · ช่วยคน → เขากลับมาในวันที่คุณต้องการ
// ผู้เล่นตายก่อนเมล็ดสุก: ความแค้นและบุญคุณตกถึงลูกหลาน (inheritSeeds)
import type { Choice, Ctx, GameEvent } from "../../../engine/events";
import { chance } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { displayName } from "../../../engine/util";
import { B, BIG, C, E, FIGHT, G, K, N, PAY, near, type Res } from "../story/kit";
import { saveSeeds, seedsOf, type Seed, type SeedKind } from "./seedStore";

const cal = (l: Life) => l.birthYear + l.age;
/** เมล็ดที่สุกแล้ว (เก่าสุดก่อน) */
export const ripeSeed = (l: Life, k: SeedKind) => seedsOf(l).filter((s) => s.k === k && s.ripe <= cal(l)).sort((a, b) => a.ripe - b.ripe)[0];
const seedOf = (l: Life, c: Ctx) => seedsOf(l).find((s) => s.id === c.sid);
const ago = (l: Life, c: Ctx) => { const s = seedOf(l, c); return s ? cal(l) - s.y : 0; };
const who = (l: Life, c: Ctx) => seedOf(l, c)?.who ?? "คนคนนั้น";
/** คนที่ทำ: "คุณ" หรือบรรพบุรุษ (เมล็ดที่ตกทอด) */
const doer = (l: Life, c: Ctx) => { const s = seedOf(l, c); return s?.by ? `${s.by} (บรรพบุรุษของคุณ)` : "คุณ"; };
const prep = (k: SeedKind) => (l: Life) => ({ sid: ripeSeed(l, k)?.id ?? "", mood: chance(l, 0.6) ? "kind" : "hard" });

/** ปิดเรื่อง (ลบเมล็ด) · later = เลื่อนไปอีกกี่ปี (หนีได้แต่ไม่พ้น) */
const close = (r: Res, later = 0): Res =>
  Object.assign(
    (l: Life, c: Ctx) => {
      const s = seedsOf(l);
      const i = s.findIndex((x) => x.id === c.sid);
      if (i >= 0) { if (later) s[i].ripe = cal(l) + later; else s.splice(i, 1); saveSeeds(l, s); }
      return r(l, c);
    },
    { fx: r.fx },
  );

/** ตัวเลือกต่อสู้ที่ปิดเรื่องด้วย (ไม่ว่าแพ้หรือชนะ เรื่องนี้จบที่การดวล) */
const fightClose = (ch: Choice): Choice => ({ ...ch, run: (l, c, ok) => { const s = seedsOf(l).filter((x) => x.id !== c.sid); saveSeeds(l, s); return ch.run(l, c, ok); } });

/** นายอำเภอที่เคยได้รับความช่วยเหลือ ปล่อยคุณออกจากคุกได้ */
const free = (r: Res): Res => Object.assign((l: Life, c: Ctx) => { if (Number(l.flags.jailUntil ?? -1) > l.age) { delete l.flags.jailUntil; delete l.flags.wanted; l.flags.heat = 0; } return r(l, c); }, { fx: r.fx });

const when = (k: SeedKind) => (l: Life) => l.worldId === "murim" && !!ripeSeed(l, k);
const W = 30; // เมล็ดที่สุกแล้วควรเกิดเร็ว ไม่ปล่อยค้างหลายปี

export const SEED_EVENTS: GameEvent[] = [
  E("dc.spared", [16, 100], (l, c) =>
    c.mood === "kind"
      ? `ชายวัยกลางคนในชุดผู้อาวุโสสำนักมายืนรอหน้าบ้าน — ${who(l, c)}ที่${doer(l, c)}ไว้ชีวิตเมื่อ ${ago(l, c)} ปีก่อน "ชีวิตที่เหลือของข้าเป็นของขวัญจากบ้านนี้ ข้ามาตอบแทน"`
      : `จดหมายท้าดวลถูกปักด้วยมีดไว้ที่ประตู ลงชื่อ${who(l, c)} — คนที่${doer(l, c)}ไว้ชีวิตเมื่อ ${ago(l, c)} ปีก่อน ฝึกวิชามาทุกวันเพื่อวันนี้`, [
    C("รับน้ำใจ", close(BIG("เขาถ่ายทอดเคล็ดวิชาที่ฝึกมาทั้งชีวิตให้หนึ่งคืนเต็ม แล้วจากไปพร้อมรอยยิ้ม — บุญคุณบางอย่างกลับมาในรูปที่ไม่คาดคิด", { exp: 1500, fame: 3, joy: 5 })), { show: (_l, c) => c.mood === "kind" }),
    C("ขอให้เขาช่วยดูแลลูกหลานแทน", close(G("เขารับคำ — ตระกูลของคุณมีผู้อาวุโสสำนักคอยคุ้มครองไปอีกรุ่น", { fame: 2, meet: { rel: "ally", bond: 75, tag: "family_guardian" } })), { show: (_l, c) => c.mood === "kind" }),
    fightClose(FIGHT("รับคำท้า", (l, c) => `${who(l, c)}ผู้กลับมาทวงแค้น`, near(1), { lethal: true, show: (_l, c) => c.mood === "hard", intro: "เขาแข็งแกร่งกว่าวันนั้นมาก — ความแค้นสิบกว่าปีกลายเป็นดาบ" })),
    K("ขอโทษที่ทำให้เขาอับอายวันนั้น", "looks", 50, close(G("เขาเงียบไปนาน แล้วหักดาบตัวเองทิ้ง \"ข้าเสียสิบปีไปกับคนที่ไม่ได้เกลียดข้าเลย\"", { align: 3, joy: 3 })), close(B("คำขอโทษไม่พอ — เขาจะกลับมาอีก", { joy: -3 }), 4), { show: (_l, c) => c.mood === "hard" }),
  ], { when: when("spared"), prepare: prep("spared"), weight: W, maxTimes: 0, title: "คนที่เคยไว้ชีวิต" }),

  E("dc.killed", [14, 100], (l, c) => `ชายหนุ่มคนหนึ่งยืนขวางทางในตรอก ดวงตาแดงก่ำ "ข้าคือลูกของ${who(l, c)} — ${ago(l, c)} ปีก่อน${doer(l, c)}ฆ่าพ่อข้าตอนข้ายังไม่สูงเท่าโต๊ะ ข้าฝึกวิชามาทั้งชีวิตเพื่อวันนี้"`, [
    fightClose(FIGHT("สู้", "ลูกชายผู้ล้างแค้น", near(0), { lethal: true, intro: "เขาใช้ท่าเดียวกับพ่อ — แต่เร็วกว่า และไม่มีอะไรจะเสียอีกแล้ว" })),
    K("คุกเข่าขอขมาหน้าหลุมศพพ่อของเขา", "looks", 45, close(BIG("คุณคุกเข่าอยู่หน้าหลุมศพจนฝนหยุดตก — เขาโยนดาบลงพื้น \"ข้าจะไม่ให้อภัย แต่ข้าจะไม่ฆ่าเจ้า\" วงจรนี้จบที่รุ่นนี้", { align: 6, fame: -2, joy: -3 })), close(B("เขาถ่มน้ำลายใส่หลุมศพที่คุณคุกเข่าอยู่ แล้วเดินจากไป — เขาจะกลับมา", { fame: -2, joy: -5 }), 3)),
    PAY("เสนอค่าทำขวัญให้ครอบครัวเขา", 80, close(N("เขารับเงินด้วยมือที่สั่น — แม่ของเขาป่วยมาหลายปี เงินไม่ได้ลบความแค้น แต่ทำให้เขาเลือกชีวิตแทนความตาย", { align: 2 }))),
    C("หนีไปตั้งตัวที่เมืองอื่น", close(N("คุณย้ายออกในคืนนั้น — แต่ความแค้นมีขา มันเดินตามคุณได้", { joy: -4 }), 6)),
  ], { when: when("killed"), prepare: prep("killed"), weight: W, maxTimes: 0, title: "ลูกของคนที่ตาย" }),

  E("dc.crippled", [16, 100], (l, c) =>
    c.mood === "kind"
      ? `${who(l, c)}ที่${doer(l, c)}ทำลายวิชาเมื่อ ${ago(l, c)} ปีก่อน ตอนนี้เป็นครูสอนหนังสือในหมู่บ้าน — เขาส่งจดหมายมา "ข้าเกลียดเจ้าอยู่สิบปี แล้วก็พบว่าชีวิตที่ไม่มีวิชาก็มีความสุขได้"`
      : `คนในตลาดพูดถึงหมอพิษขาเป๋คนหนึ่งที่ซื้อพิษทุกชนิดที่หาได้ — ${who(l, c)}ที่${doer(l, c)}ทำลายวิชาเมื่อ ${ago(l, c)} ปีก่อน ไม่ได้ลืม`, [
    C("ตอบจดหมาย ขอโทษอย่างจริงใจ", close(G("เขาตอบกลับสั้นๆ \"ข้าให้อภัยแล้ว — อย่าทำกับใครอีก\"", { align: 5, joy: 4 })), { show: (_l, c) => c.mood === "kind" }),
    C("ไม่ตอบ", close(N("จดหมายถูกเก็บไว้ในลิ้นชัก — บางครั้งคุณหยิบมาอ่านตอนนอนไม่หลับ"))),
    K("ระวังตัว ตรวจทุกอย่างที่กิน", "smarts", 55, close(G("ชามน้ำแกงคืนหนึ่งมีกลิ่นอัลมอนด์ — คุณเททิ้ง แล้วส่งคนไปบอกเขาว่าคุณรู้แล้ว เขาไม่กล้าลองอีก", { joy: -2 })), close(B("คุณระวังไม่พอ — พิษเรื้อรังเข้าไปในร่างกาย", { hp: -20, wound: ["organs", "poison", 2] })), { show: (_l, c) => c.mood === "hard" }),
    K("ไปหาเขาเพื่อจบเรื่องด้วยคำพูด", "looks", 50, close(G("คุณนั่งกินข้าวกับเขาหนึ่งมื้อโดยไม่แตะตะเกียบ — เขาหัวเราะออกมาเป็นครั้งแรกในรอบสิบปี", { align: 4 })), close(B("เขาไม่ยอมเปิดประตู — แต่ตอนนี้รู้ว่าคุณกลัว", { joy: -3 }), 3), { show: (_l, c) => c.mood === "hard" }),
  ], { when: when("crippled"), prepare: prep("crippled"), weight: W, maxTimes: 0, title: "คนที่เคยถูกทำลายวิชา" }),

  E("dc.betrayed", [16, 100], (l, c) => `${who(l, c)}ออกจากคุกแล้ว — ${ago(l, c)} ปีก่อนคุณเอ่ยชื่อเขาในห้องสอบสวนเพื่อรอดตัว เขามายืนอยู่หน้าบ้าน ผอมจนแทบจำไม่ได้`, [
    C("สารภาพว่าเป็นคุณเอง ขอโทษ", close(G("เขาต่อยหน้าคุณหนึ่งที แล้วนั่งลงร้องไห้ — คืนนั้นคุณสองคนดื่มเหล้าด้วยกันจนเช้า", { hp: -3, align: 4 }))),
    PAY("ชดใช้เงินช่วยเขาตั้งตัว", 50, close(N("เขารับเงินไปโดยไม่มองหน้า — อย่างน้อยเขามีที่นอนคืนนี้", { align: 2 }))),
    C("ปฏิเสธว่าไม่ใช่คุณ", close(B("เขารู้ — ในคุกมีคนเล่าให้ฟังหมดแล้ว เขาเดินจากไปพร้อมความแค้นที่หนักกว่าเดิม", { align: -3, fame: -2 }))),
  ], { when: when("betrayed"), prepare: prep("betrayed"), weight: W, maxTimes: 0, title: "คนที่ออกจากคุก" }),

  E("dc.kindness", [16, 100], (l, c) => `ขบวนเกี้ยวหยุดหน้าบ้าน${l.flags.jailUntil && Number(l.flags.jailUntil) > l.age ? " (ที่คุกของคุณ)" : ""} — ผู้ที่ก้าวลงมาคือ${who(l, c)}ที่${doer(l, c)}เคยช่วยไว้เมื่อ ${ago(l, c)} ปีก่อน วันนี้เขาเป็นนายอำเภอ "ข้ามาตามหาบ้านนี้มาสามปี"`, [
    C("รับความช่วยเหลือ", close(free(BIG("เขาจัดการเรื่องที่ค้างคาในชีวิตคุณให้ภายในเดือนเดียว — คดีความ หนี้สิน และป้ายชื่อหน้าร้าน", { tael: 60, fame: 4, joy: 6 }))), {}),
    C("บอกว่าไม่ต้องตอบแทน ขอให้ช่วยคนอื่นต่อไป", close(BIG("เขาโค้งคำนับต่ำที่สุดที่คุณเคยเห็น — ปีนั้นอำเภอของเขาเปิดโรงทานแห่งใหม่ ป้ายหน้าโรงทานมีชื่อของคุณ", { align: 6, fame: 6, joy: 5 }))),
  ], { when: when("kindness"), prepare: prep("kindness"), weight: W, maxTimes: 0, title: "คนที่เคยช่วยไว้" }),

  E("dc.sold_trap", [16, 100], (l, c) => `หญิงชราคนหนึ่งตามหาคุณจนเจอ — ${ago(l, c)} ปีก่อนลูกชายนางซื้อข่าวสมบัติจากคุณ แล้วไม่ได้กลับบ้านอีกเลย`, [
    C("บอกความจริงทั้งหมด", close(N("นางฟังจนจบโดยไม่ร้องไห้ แล้วเดินกลับไปอย่างช้าๆ — คุณรู้ว่าตัวเองจะจำหน้านางไปจนตาย", { align: 3, joy: -6 }))),
    PAY("ดูแลนางไปจนสิ้นอายุขัย", 40, close(G("คุณส่งข้าวส่งยาให้นางทุกเดือนจนนางจากไปอย่างสงบ — มันไม่ได้ลบอะไร แต่มันคือสิ่งเดียวที่ทำได้", { align: 5 }))),
    C("ไล่นางไป", close(B("ข่าวเรื่องคนขายข่าวลวงจนคนตายแพร่ไปทั้งตลาด", { fame: -6, align: -4 }))),
  ], { when: when("sold_trap"), prepare: prep("sold_trap"), weight: W, maxTimes: 0, title: "แม่ของคนที่ไม่กลับมา" }),
];

/** มรดกของการกระทำ: ความแค้นและบุญคุณที่ยังไม่สุก ตกถึงลูก/ศิษย์ (ไม่ตกถึงคนแปลกหน้ายุคใหม่) */
export function inheritSeeds(dead: Life, next: Life) {
  const carry = seedsOf(dead).filter((s) => ["killed", "crippled", "kindness", "spared"].includes(s.k));
  if (!carry.length) return;
  const by = displayName(dead);
  const s: Seed[] = carry.map((x) => ({ ...x, by: x.by ?? by, ripe: Math.max(x.ripe, next.birthYear + 16) }));
  saveSeeds(next, [...seedsOf(next), ...s]);
}
