// Phase 3 — หลังบาดเจ็บถาวร ชีวิตยังไปต่อได้: ฝึกมืออีกข้าง · ฟังเสียงลมแทนตา · สายวิชาภายนอก/แพทย์ · อวัยวะเทียม · หมอเทวดา
import { ACTIVITIES } from "../../../engine/activities";
import { HEALERS, bodyOf, hasInjury, openInjuries, permanentInjuries, treat } from "../../../engine/body";
import type { GameEvent, Outcome } from "../../../engine/events";
import { runEvent } from "../../../engine/game";
import type { Life } from "../../../engine/types";
import { addMoney, addStat, money } from "../../../engine/util";
import { setGoal } from "./goals";

const good = (text: string): Outcome => ({ text, kind: "good" });
const meh = (text: string): Outcome => ({ text });

const armGone = (l: Life) => hasInjury(l, "armR", ["severed"], 3) || hasInjury(l, "handR", ["fingers", "tendon"], 3);
const blind = (l: Life) => hasInjury(l, "eyeL", ["blind"], 3) && hasInjury(l, "eyeR", ["blind"], 3);
const legGone = (l: Life) => (["legL", "legR"] as const).find((s) => hasInjury(l, s, ["severed"], 3) && !l.body!.injuries.some((i) => i.part === s && i.aid));
const dantianGone = (l: Life) => hasInjury(l, "dantian", ["shattered"], 3);

export const BODY_EVENTS: GameEvent[] = [
  {
    id: "body.offhand",
    minAge: 10,
    maxAge: 80,
    forced: true,
    when: (l) => armGone(l) && !l.body!.offHand && l.body!.offHandFrom === undefined && !l.flags.bodyOffhandAsked,
    title: "มือที่หายไป",
    text: () => "ทุกเช้าคุณยังเอื้อมมือขวาไปหยิบกระบี่ทั้งที่มันไม่อยู่แล้ว ศิษย์พี่คนหนึ่งเคยบอกว่า 'ยอดฝีมือบางคนเก่งที่สุดหลังจากเสียแขนไปข้างหนึ่ง'",
    choices: [
      { label: "ฝึกมือซ้ายใหม่ตั้งแต่ศูนย์", pros: "สามปีต่อมาจะสู้ได้เกือบเท่าเดิม", cons: "สามปีที่เจ็บปวดและอับอาย", run: (l) => { l.flags.bodyOffhandAsked = true; bodyOf(l).offHandFrom = l.age; addStat(l, "happiness", -4); return meh("คุณจับกระบี่ด้วยมือซ้ายครั้งแรก มันหนักกว่าที่จำได้มาก"); } },
      { label: "วางกระบี่ หันไปเป็นครูสอนเด็ก", pros: "ใช้ความรู้ที่มีต่อไป", cons: "ไม่ได้ต่อสู้อีก", run: (l) => { l.flags.bodyOffhandAsked = true; l.flags.mwTeacher = true; addStat(l, "happiness", 3); return good("เด็กในหมู่บ้านมานั่งเรียงแถวทุกเช้า — คุณสอนท่าเท้าด้วยการเดินให้ดู"); } },
      { label: "ยอมรับ ใช้ชีวิตแบบคนธรรมดา", run: (l) => { l.flags.bodyOffhandAsked = true; addStat(l, "happiness", -6); return meh("คุณแขวนกระบี่ไว้บนผนัง แล้วไม่ได้หยิบลงมาอีกเลย"); } },
    ],
  },
  {
    id: "body.listen",
    minAge: 10,
    maxAge: 80,
    forced: true,
    when: (l) => blind(l) && !l.body!.listening && l.body!.listenFrom === undefined && !l.flags.bodyListenAsked,
    title: "โลกที่มืดสนิท",
    text: () => "โลกของคุณมืดสนิท แต่เสียงกลับชัดขึ้นทุกวัน — เสียงลมผ่านใบไผ่ เสียงหายใจของคนที่ยืนอยู่ไกลออกไปสิบก้าว",
    choices: [
      { label: "ฝึกฟังเสียงลมแทนดวงตา", pros: "สี่ปีต่อมาจะต่อสู้ในความมืดได้", cons: "ช่วงแรกล้มลุกคลุกคลาน", run: (l) => { l.flags.bodyListenAsked = true; bodyOf(l).listenFrom = l.age; return meh("คุณนั่งสมาธิใต้น้ำตกทุกวัน ฟังจนรู้ว่าหยดน้ำแต่ละหยดตกตรงไหน"); } },
      { label: "เรียนดีดพิณ หาเลี้ยงชีพด้วยดนตรี", pros: "ชีวิตสงบ มีรายได้", cons: "ทิ้งวิชายุทธ์", run: (l) => { l.flags.bodyListenAsked = true; l.flags.mwMusician = true; addStat(l, "happiness", 4); return good("เสียงพิณของคุณทำให้คนในโรงน้ำชาเงียบได้ทั้งร้าน"); } },
    ],
  },
  {
    id: "body.dantian",
    minAge: 10,
    maxAge: 85,
    forced: true,
    when: (l) => dantianGone(l) && !l.body!.external && !l.flags.bodyDantianAsked,
    title: "ตันเถียนแตกสลาย",
    text: () => "ลมปราณที่สะสมมาทั้งชีวิตรั่วไหลออกไปหมด คุณยกถ้วยชายังมือสั่น หมอทุกคนพูดเหมือนกัน: 'หมดหนทาง'",
    choices: [
      { label: "ฝึกวิชาภายนอก — ร่างกายคืออาวุธ", pros: "ต่อสู้ได้อีกครั้ง (แม้ไม่เท่าเดิม)", cons: "ฝึกหนักจนร่างกายทรุด", run: (l) => { l.flags.bodyDantianAsked = true; bodyOf(l).external = true; addStat(l, "health", -6); return good("คุณทุบหินด้วยมือเปล่าทุกวันจนกระดูกนิ้วหนาเหมือนเหล็ก — ไม่มีลมปราณ ก็ยังมีกระดูก"); } },
      { label: "หันไปศึกษาการแพทย์", pros: "ช่วยคนอื่นที่เจ็บแบบเดียวกัน", cons: "เป้าหมายเดิมต้องวางลง", run: (l) => { l.flags.bodyDantianAsked = true; setGoal(l, "healer", "เพราะรู้ดีว่าการสูญเสียพลังเจ็บปวดแค่ไหน"); return good("คุณเปิดตำราแพทย์เล่มแรก — มือที่เคยถือกระบี่ ตอนนี้ถือเข็มทอง"); } },
      { label: "ออกตามหาหมอเทวดาแห่งหุบเขายา", pros: "อาจรักษาให้หายได้", cons: "แพงมาก และอาจไม่สำเร็จ", run: (l) => { l.flags.bodyDantianAsked = true; l.flags.seekDivine = true; return meh("ว่ากันว่าหมอเทวดาซ่อนตัวอยู่ในหุบเขาที่หมอกไม่เคยจาง — คุณออกเดินทาง"); } },
    ],
  },
  {
    id: "body.prosthetic",
    minAge: 12,
    maxAge: 85,
    weight: (l) => (legGone(l) ? 20 : 0),
    maxTimes: 2,
    title: "ขาไม้",
    text: (l) => `ช่างไม้ชราที่ปลายตลาดวัดขาของคุณอย่างละเอียด "ข้าทำขาไม้ให้ได้ ใช้ไม้หอมเนื้อแข็ง เดินได้เกือบเหมือนขาจริง" — ราคา ${money(l, 30_000)}`,
    choices: [
      { label: (l) => `สั่งทำ (${money(l, 30_000)})`, show: (l) => l.money >= 30_000, pros: "เดินได้ สู้ได้ดีขึ้น", run: (l) => { addMoney(l, -30_000); const s = legGone(l); const inj = l.body!.injuries.find((i) => i.part === s && i.kind === "severed"); if (inj) inj.aid = true; addStat(l, "happiness", 6); return good("เสียงไม้กระทบพื้นกลายเป็นเสียงประจำตัวคุณ — คนในตลาดได้ยินก็รู้ว่าใครมา"); } },
      { label: "ยังไม่ทำตอนนี้", run: () => meh("คุณเดินกะเผลกด้วยไม้เท้าต่อไป") },
    ],
  },
  {
    id: "body.divine",
    minAge: 14,
    maxAge: 90,
    weight: (l) => (permanentInjuries(l).some((i) => ["blind", "shattered", "tendon", "deaf"].includes(i.kind)) ? (l.flags.seekDivine ? 25 : 3) : 0),
    maxTimes: 2,
    title: "หมอเทวดาแห่งหุบเขายา",
    text: (l) => `ในหุบเขาที่หมอกไม่เคยจาง ชายชราผมขาวโพลนจับชีพจรคุณนิ่งๆ "รักษาได้ แต่ค่ารักษาคือ ${money(l, HEALERS[2].cost)} — หรือเจ้าจะยอมเป็นคนรับใช้ข้าห้าปี?"`,
    choices: [
      { label: (l) => `จ่ายค่ารักษา (${money(l, HEALERS[2].cost)})`, show: (l) => l.money >= HEALERS[2].cost, pros: "อาจได้อวัยวะคืน", cons: `สำเร็จราว ${Math.round(HEALERS[2].odds * 100)}%`, run: (l) => { addMoney(l, -HEALERS[2].cost); const r = treat(l, 2); l.flags.seekDivine = false; return r.ok ? { text: r.text, kind: "milestone" } : meh(r.text); } },
      { label: "ยอมเป็นคนรับใช้ห้าปี", pros: "ไม่ต้องใช้เงิน", cons: "ห้าปีห่างจากทุกคน", run: (l) => { l.flags.seekDivine = false; l.flags.secludeUntil = l.age + 5; for (const p of l.people) if (p.alive) p.bond = Math.max(0, p.bond - 10); const r = treat(l, 2); return r.ok ? { text: `ห้าปีของการบดยาและผ่าฟืน — แล้ววันหนึ่งเขาก็ลงเข็มให้คุณ: ${r.text}`, kind: "milestone" } : meh(`ห้าปีผ่านไป เขาลองรักษาแล้ว — ${r.text}`); } },
      { label: "ปฏิเสธ แล้วกลับบ้าน", run: (l) => { l.flags.seekDivine = false; return meh("บางทีการยอมรับสิ่งที่เสียไป อาจเป็นการรักษาอย่างหนึ่ง"); } },
    ],
  },
  {
    id: "body.treat",
    minAge: 0,
    maxAge: 200,
    manual: true,
    maxTimes: 0,
    title: "หาหมอรักษาบาดแผล",
    text: (l) => { const o = openInjuries(l); return o.length ? `บาดแผลที่ยังไม่หาย: ${o.length} แห่ง — จะไปหาหมอคนไหน?` : "ร่างกายคุณไม่มีแผลที่ต้องรักษาตอนนี้ แต่หมอยังช่วยบำรุงร่างกายได้"; },
    choices: [
      { label: "ไม่ไปแล้ว ปล่อยให้แผลหายเอง", cons: "แผลสาหัสอาจกลายเป็นพิการถาวร", run: () => meh("คุณพันแผลเองด้วยผ้าสะอาด แล้วภาวนาให้มันหายเร็วๆ") },
      ...HEALERS.slice(0, 2).map((h) => ({
      label: (l: Life) => `${h.name} (${money(l, h.cost)})`,
      pros: h.desc,
      cons: `ได้ผลราว ${Math.round(h.odds * 100)}%`,
      req: (l: Life) => (l.age >= 18 && l.money < h.cost ? `ต้องมี ${money(l, h.cost)}` : undefined),
      run: (l: Life) => {
        if (l.age >= 18) addMoney(l, -h.cost);
        const r = treat(l, h.id as 0 | 1);
        if (!openInjuries(l).length) addStat(l, "health", h.id === 0 ? 4 : 8);
        return r.ok ? good(r.text) : meh(r.text);
      },
    })),
    ],
  },
];

// ปุ่มในแท็บ "ทำ": หาหมอรักษาบาดแผล (แทนการไปหาหมอแบบเดิมในยุทธภพ)
ACTIVITIES.push({
  id: "m_heal",
  emoji: "🩹",
  name: "หาหมอรักษาบาดแผล",
  desc: "รักษาแผล ลดเวลาฟื้นตัว",
  minAge: 3,
  world: "murim",
  available: (l) => openInjuries(l).length > 0 || l.stats.health < 60,
  run: (l) => {
    runEvent(l, "body.treat");
    return { text: "" };
  },
});

