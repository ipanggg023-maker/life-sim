// Phase 2 — เหตุการณ์ที่เกิดจากความรู้สึกและความทรงจำของ NPC จริงๆ (ไม่ใช่สุ่มลอยๆ)
// ทุกฉากเลือกคนจากสถานะความสัมพันธ์ปัจจุบัน แล้วผลที่ได้ถูกจดเป็นความทรงจำของเขา
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { feel, hasTrait, relOf, remember, reveal } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { addFame, addMoney, addStat, money, relationLabel, shortName } from "../../../engine/util";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const alive = (l: Life) => l.people.filter((p) => p.alive && p.age >= 14);
const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const pickBy = (l: Life, f: (p: Person) => boolean) => { const xs = alive(l).filter(f); return xs.length ? pick(l, xs) : undefined; };
const loanSize = (l: Life) => Math.max(20_000, Math.round(Math.max(0, l.money) * 0.2 / 1000) * 1000);

export const NPC_EVENTS: GameEvent[] = [
  {
    id: "npc.borrow",
    minAge: 18,
    maxAge: 80,
    weight: (l) => (l.money >= 40_000 && alive(l).some((p) => p.relation !== "child" && relOf(p).love >= 30) ? 6 : 0),
    maxTimes: 4,
    prepare: (l) => { const p = pickBy(l, (x) => x.relation !== "child" && relOf(x).love >= 30)!; return { pid: p.id, amt: loanSize(l) }; },
    title: "ขอยืมเงิน",
    text: (l, c) => `${relationLabel(who(l, c)!, l)} ${nm(l, c)}มาหาตอนค่ำ หน้าตาเครียด "${pick(l, ["ลูกข้าป่วยหนัก ค่ายาแพงเหลือเกิน", "ข้าลงทุนค้าขายแล้วถูกโกง", "เจ้าหนี้จะยึดบ้านข้า"])} ขอยืม ${money(l, Number(c.amt))} ได้ไหม"`,
    choices: [
      { label: (l, c) => `ให้ยืม (${money(l, Number(c.amt))})`, show: (l, c) => l.money >= Number(c.amt), run: (l, c) => { const p = who(l, c)!; addMoney(l, -Number(c.amt)); remember(l, p, "loan", "ให้ยืมเงินตอนลำบาก", 2, { debt: 45, love: 8, trust: 6 }); p.tags = [...(p.tags ?? []), `owes:${c.amt}`]; return good(`${nm(l, c)}จับมือคุณแน่น "ข้าจะไม่ลืมเลย" — เงินจะกลับมาไหม ขึ้นอยู่กับว่าเขาเป็นคนแบบไหน`); } },
      { label: "ให้เปล่าๆ ไม่ต้องคืน", show: (l, c) => l.money >= Number(c.amt), run: (l, c) => { const p = who(l, c)!; addMoney(l, -Number(c.amt)); remember(l, p, "gift_money", "ให้เงินช่วยโดยไม่ขอคืน", 3, { debt: 70, love: 12, loyalty: 15 }); addFame(l, 1); return good(`${nm(l, c)}คุกเข่าลงตรงนั้น — บุญคุณแบบนี้ บางคนจำไปจนตาย`); } },
      { label: "ปฏิเสธอย่างสุภาพ", run: (l, c) => { const p = who(l, c)!; remember(l, p, "refused_loan", "ไม่ยอมให้ยืมเงินตอนลำบาก", 1, { love: -6, trust: -3, grudge: hasTrait(p, "vengeful") ? 10 : 2 }); return meh(`${nm(l, c)}พยักหน้าช้าๆ แล้วเดินกลับไปในความมืด`); } },
    ],
  },
  {
    id: "npc.repay",
    minAge: 18,
    maxAge: 90,
    weight: (l) => (alive(l).some((p) => p.tags?.some((t) => t.startsWith("owes:"))) ? 12 : 0),
    maxTimes: 0,
    prepare: (l) => { const p = pickBy(l, (x) => !!x.tags?.some((t) => t.startsWith("owes:")))!; return { pid: p.id, amt: Number(p.tags!.find((t) => t.startsWith("owes:"))!.slice(5)) }; },
    text: (l, c) => {
      const p = who(l, c)!;
      const honest = hasTrait(p, "honest") || hasTrait(p, "filial") || relOf(p).debt >= 50;
      return honest ? `${nm(l, c)}มาคืนเงิน ${money(l, Number(c.amt))} ครบทุกอีแปะ พร้อมไก่สองตัวเป็นดอกเบี้ย` : `ผ่านมาหลายปีแล้ว ${nm(l, c)}ยังไม่พูดถึงเงิน ${money(l, Number(c.amt))} ที่ยืมไปเลย — เจอหน้ากันก็ทำเป็นไม่เห็น`;
    },
    choices: [
      {
        label: "รับไว้ / ทวงอย่างนุ่มนวล",
        run: (l, c) => {
          const p = who(l, c)!;
          p.tags = (p.tags ?? []).filter((t) => !t.startsWith("owes:"));
          const honest = hasTrait(p, "honest") || hasTrait(p, "filial") || relOf(p).debt >= 50;
          if (honest || chance(l, 0.4)) { addMoney(l, Number(c.amt)); feel(p, { trust: 5 }); return good("เงินกลับมาครบ ความไว้ใจระหว่างคุณสองคนแน่นขึ้น"); }
          remember(l, p, "dunned", "ถูกทวงหนี้", 1, { love: -4, grudge: 4 });
          return bad(`${nm(l, c)}บ่นว่าลำบาก ขอผัดไปก่อน — คุณรู้ในใจว่าเงินก้อนนี้คงไม่กลับมาแล้ว`);
        },
      },
      { label: "ยกหนี้ให้", run: (l, c) => { const p = who(l, c)!; p.tags = (p.tags ?? []).filter((t) => !t.startsWith("owes:")); remember(l, p, "forgave_debt", "ยกหนี้ให้", 2, { debt: 30, love: 8, loyalty: 8 }); return good(`${nm(l, c)}ไม่พูดอะไร แต่ตาแดงก่ำ`); } },
    ],
  },
  {
    id: "npc.saves_you",
    minAge: 16,
    maxAge: 90,
    weight: (l) => (l.stats.health < 45 && alive(l).some((p) => relOf(p).debt >= 50 || relOf(p).loyalty >= 75) ? 10 : 0),
    maxTimes: 3,
    prepare: (l) => ({ pid: pickBy(l, (x) => relOf(x).debt >= 50 || relOf(x).loyalty >= 75)!.id }),
    title: "บุญคุณทดแทน",
    text: (l, c) => `ตอนที่คุณนอนซมไข้ขึ้นสูง ${nm(l, c)}ขี่ม้าฝ่าฝนมาสามวันสามคืน พร้อมห่อยาที่ขายบ้านไปครึ่งหลังเพื่อซื้อมา`,
    choices: [
      { label: "รับไว้ด้วยน้ำตา", run: (l, c) => { const p = who(l, c)!; addStat(l, "health", randInt(l, 15, 25)); feel(p, { debt: -40, love: 6 }); remember(l, p, "saved_by", "ช่วยชีวิตคุณไว้", 3, { loyalty: 5 }); return good(`ไข้ลดลงในคืนที่สอง ${nm(l, c)}หลับคาเก้าอี้ข้างเตียง — บุญคุณที่คุณเคยให้ ถูกทดแทนแล้ว`); } },
    ],
  },
  {
    id: "npc.betrayal",
    minAge: 18,
    maxAge: 80,
    weight: (l) => (alive(l).some((p) => (hasTrait(p, "cunning") || hasTrait(p, "greedy")) && relOf(p).jealousy >= 35 && relOf(p).trust < 50) ? 7 : 0),
    maxTimes: 2,
    prepare: (l) => ({ pid: pickBy(l, (x) => (hasTrait(x, "cunning") || hasTrait(x, "greedy")) && relOf(x).jealousy >= 35 && relOf(x).trust < 50)!.id }),
    title: "แทงข้างหลัง",
    text: (l, c) => `คุณเพิ่งรู้ว่าคนที่เอาความลับเรื่อง${pick(l, ["เส้นทางขนสินค้า", "เงินที่คุณเก็บไว้", "จุดอ่อนในวิชาของคุณ", "ครอบครัวของคุณ"])}ไปขายให้คู่แข่ง คือ${nm(l, c)} — คนที่คุณเคยเรียกว่าสหาย`,
    choices: [
      { label: "เผชิญหน้าต่อหน้าทุกคน", check: { stat: "looks", dc: 50 }, run: (l, c, ok) => { const p = who(l, c)!; remember(l, p, "exposed", "ถูกประจานเรื่องทรยศ", 3, { fear: 20, grudge: 25, trust: -30 }); if (ok) { addFame(l, 3); return good(`${nm(l, c)}หน้าซีดเผือดต่อหน้าคนทั้งตลาด ไม่มีใครค้าขายกับเขาอีกเลย — แต่เขาจะไม่ลืมวันนี้`); } addFame(l, -2); return bad(`${nm(l, c)}ตีหน้าเศร้าเล่นละครเก่งกว่า คนส่วนใหญ่เชื่อเขา ไม่ใช่คุณ`); } },
      { label: "ตัดขาดเงียบๆ", run: (l, c) => { const p = who(l, c)!; p.relation = "rival"; feel(p, { trust: -40 }); return meh(`คุณไม่พูดอะไรสักคำ แค่ไม่เปิดประตูให้${nm(l, c)}อีก`); } },
      { label: "แกล้งไม่รู้ แล้วป้อนข่าวปลอมกลับไป", check: { stat: "smarts", dc: 60 }, run: (l, c, ok) => { const p = who(l, c)!; if (ok) { addMoney(l, randInt(l, 30, 120) * 1000); remember(l, p, "fooled", "ถูกหลอกให้ส่งข่าวปลอม", 2, { grudge: 10 }, false); return good("คู่แข่งตกหลุมที่คุณวางไว้ เสียหายหนัก — และเริ่มสงสัยคนที่ขายข่าวให้"); } return bad(`${nm(l, c)}จับได้ว่าคุณรู้แล้ว และหายตัวไปจากเมืองในคืนนั้น`); } },
    ],
  },
  {
    id: "npc.reconcile",
    minAge: 16,
    maxAge: 90,
    weight: (l) => (alive(l).some((p) => relOf(p).grudge >= 25 && relOf(p).grudge < 70 && p.relation !== "rival") ? 6 : 0),
    maxTimes: 3,
    prepare: (l) => ({ pid: pickBy(l, (x) => relOf(x).grudge >= 25 && relOf(x).grudge < 70 && x.relation !== "rival")!.id }),
    title: "ความบาดหมางที่ค้างคา",
    text: (l, c) => { const p = who(l, c)!; const m = p.mem?.filter((x) => x.known && x.w >= 1).pop(); return `คุณกับ${nm(l, c)}ไม่ได้คุยกันดีๆ มานานแล้ว${m ? ` ตั้งแต่เรื่อง "${m.text}" ตอนคุณอายุ ${m.age}` : ""} วันนี้บังเอิญเจอกันที่ศาลเจ้า`; },
    choices: [
      { label: "ขอโทษก่อน", run: (l, c) => { const p = who(l, c)!; const r = relOf(p); const ok = !hasTrait(p, "vengeful") || chance(l, 0.4); if (ok) { feel(p, { grudge: -25, trust: 8, love: 5 }); remember(l, p, "apology", "คุณยอมขอโทษก่อน", 2, { respect: 5 }); return good(`${nm(l, c)}ถอนหายใจยาว "ข้าก็ผิดเหมือนกัน" — ความบาดหมาง${r.grudge < 20 ? "จบลงแล้ว" : "เบาลงมาก"}`); } feel(p, { respect: -5 }); return bad(`${nm(l, c)}หันหลังให้ "คำขอโทษไม่ได้ทำให้อะไรกลับมา"`); } },
      { label: (l) => `ชดใช้ด้วยของมีค่า (${money(l, 30_000)})`, show: (l) => l.money >= 30_000, run: (l, c) => { const p = who(l, c)!; addMoney(l, -30_000); feel(p, { grudge: hasTrait(p, "greedy") ? -30 : -12, love: 3 }); return meh(hasTrait(p, "greedy") ? `${nm(l, c)}รับของไปพร้อมยิ้มกว้าง ดูเหมือนเรื่องเก่าจะไม่สำคัญแล้ว` : `${nm(l, c)}รับไว้ แต่สายตายังเย็นชา — ของมีค่าซื้อความรู้สึกได้ไม่หมด`); } },
      { label: "เดินผ่านไปเฉยๆ", run: (l, c) => { feel(who(l, c)!, { grudge: 3 }); return meh("คุณสองคนเดินสวนกันเหมือนคนแปลกหน้า"); } },
    ],
  },
  {
    id: "npc.secret_out",
    minAge: 16,
    maxAge: 90,
    weight: (l) => (alive(l).some((p) => p.mem?.some((m) => !m.known)) ? 8 : 0),
    maxTimes: 0,
    prepare: (l) => { const p = pickBy(l, (x) => !!x.mem?.some((m) => !m.known))!; return { pid: p.id, k: p.mem!.find((m) => !m.known)!.k }; },
    title: "ความลับรั่ว",
    text: (l, c) => `${nm(l, c)}จ้องหน้าคุณนิ่ง "ข้ารู้แล้ว… เรื่องที่เจ้าทำลับหลังข้า" — ความลับไม่เคยอยู่ได้ตลอดไป`,
    choices: [
      { label: "ยอมรับตรงๆ", run: (l, c) => { const p = who(l, c)!; reveal(p, String(c.k), 20); feel(p, { respect: 6, grudge: -8 }); return meh(`${nm(l, c)}โกรธ แต่ก็นับถือที่คุณไม่โกหก`); } },
      { label: "ปฏิเสธเสียงแข็ง", check: { stat: "smarts", dc: 55 }, run: (l, c, ok) => { const p = who(l, c)!; if (ok) { feel(p, { trust: -5 }); return meh(`${nm(l, c)}ยังลังเล — ครั้งนี้คุณรอดไปได้`); } reveal(p, String(c.k), 35); return bad(`หลักฐานชัดเกินจะปฏิเสธ ${nm(l, c)}เกลียดคุณทั้งเรื่องที่ทำ และเรื่องที่โกหก`); } },
    ],
  },
];
