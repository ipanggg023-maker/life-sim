import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill, openHiddenSlot } from "../../../engine/game";
import { memoryOdds, observe, remembers, useMemory } from "../../../engine/memory";
import { chance, pick, randInt } from "../../../engine/rng";
import type { HunterClass, Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, formatMoney, hasTalent, people, shortName } from "../../../engine/util";
import {
  GUILDS,
  awaken,
  classById,
  fightOdds,
  gainExp,
  gateRewards,
  guildById,
  offerClasses,
  rankName,
  rankUp,
  rollAwakening,
  survivalOdds,
} from "../power";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

const P = (l: Life) => l.power;
const rank = (l: Life) => l.power?.rank ?? -1;
const isHunter = (l: Life) => l.job?.careerId === "hunter";
const mundaneAdult = (l: Life) => !l.power && !!l.flags.awakenDone;

function damage(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

/** สร้างตัวเลือกปลุกพลังแบบเลือกสายจาก ctx.offer */
function classChoices(onPick: (l: Life, c: Ctx, cls: HunterClass) => Outcome) {
  return (["sword", "mage", "healer", "assassin", "tank", "summoner"] as HunterClass[]).map((id) => ({
    label: `${classById(id).emoji} ${classById(id).name}`,
    tone: id === "summoner" ? ("special" as const) : undefined,
    show: (_l: Life, c: Ctx) => String(c.offer ?? "").split(",").includes(id),
    run: (l: Life, c: Ctx) => onPick(l, c, id),
  }));
}

export const HUNTER_LIFE_EVENTS: GameEvent[] = [
  // ───────── กิลด์ ─────────
  {
    id: "hunter.guild_offer",
    minAge: 18,
    maxAge: 55,
    maxTimes: 3,
    weight: (l) => (P(l) && !P(l)!.guild && isHunter(l) ? 14 : 0),
    prepare: (l) => {
      const ok = GUILDS.filter((g) => g.minRank <= rank(l));
      return { g: pick(l, ok.length ? ok : [GUILDS[0]]).id };
    },
    text: (_l, c) => {
      const g = guildById(String(c.g))!;
      return `แมวมองจาก${g.name}ส่งข้อความมาหาคุณ "สนใจร่วมงานกับเราไหม?" (${g.desc})`;
    },
    choices: [
      {
        label: "ตกลงเข้าร่วม",
        run: (l, c) => {
          const g = guildById(String(c.g))!;
          l.power!.guild = g.id;
          addStat(l, "happiness", 6);
          return good(`คุณเซ็นสัญญากับ${g.name}! รายได้และความปลอดภัยในการบุก Gate เปลี่ยนไป`);
        },
      },
      { label: "ปฏิเสธ ขอเป็นอิสระ", run: () => meh("คุณตอบกลับอย่างสุภาพ แมวมองส่งสติกเกอร์ยกนิ้วกลับมา") },
    ],
  },
  {
    id: "hunter.guild_dirty_job",
    minAge: 18,
    maxAge: 60,
    weight: (l) => (P(l)?.guild === "moon" ? 20 : 0),
    text: () => "หัวหน้ากิลด์เงาจันทร์เรียกคุณเข้าห้องปิดไฟ \"มี Hunter คนหนึ่งรู้มากเกินไป ภารกิจนี้... ให้เขาไม่ได้ออกมาจาก Gate\"",
    choices: [
      {
        label: "รับงาน",
        run: (l) => { addMoney(l, 5_000_000); addFame(l, -10); addStat(l, "happiness", -15); l.flags.blood = true; return bad("คุณได้เงินห้าล้าน และฝันร้ายที่จะตามหลอกหลอนทุกคืน"); },
      },
      {
        label: "ปฏิเสธและลาออกจากกิลด์",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l) + 1),
        survival: (l) => survivalOdds(l, rank(l) + 1),
        run: (l, _c, ok) => {
          l.power!.guild = undefined;
          if (ok) { addFame(l, 6); return good("พวกมันส่งคนมาดักคุณที่ลานจอดรถ แต่คุณจัดการได้หมด และส่งหลักฐานให้สมาคม"); }
          if (!chance(l, survivalOdds(l, rank(l) + 1))) { kill(l, "ถูกกิลด์เงาจันทร์ลอบสังหาร"); return bad("ไฟในลานจอดรถดับลง… คุณไม่ได้กลับบ้านอีกเลย"); }
          return bad("คุณรอดจากการลอบสังหารมาได้หวุดหวิด" + damage(l, 20, 35, "ถูกกิลด์เงาจันทร์ลอบสังหาร"));
        },
      },
    ],
  },
  {
    id: "hunter.guild_war",
    minAge: 20,
    maxAge: 60,
    weight: (l) => (P(l)?.guild && rank(l) >= 3 ? 5 : 0),
    text: (l) => `${guildById(P(l)!.guild)!.name} กับกิลด์คู่แข่งแย่งสิทธิ์เคลียร์ Gate แรงก์ A ที่เพิ่งเปิด สองฝ่ายเผชิญหน้ากันหน้าประตู`,
    choices: [
      {
        label: "ท้าดวลตัวต่อตัวกับเอซของอีกฝ่าย",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 12); addMoney(l, 3_000_000); return good("คุณชนะอย่างขาดลอย กิลด์ได้สิทธิ์ และคุณได้โบนัสสามล้าน"); }
          return bad("คุณแพ้ต่อหน้ากล้องนักข่าว" + damage(l, 10, 20, "บาดเจ็บจากการดวล"));
        },
      },
      { label: "เสนอให้ร่วมมือกัน", check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => (ok ? (addFame(l, 6), good("สองกิลด์บุกร่วมกันสำเร็จ คุณได้รับคำชมจากสมาคม")) : meh("ไม่มีใครฟังคุณ สุดท้ายสมาคมต้องเข้ามาไกล่เกลี่ย")) },
    ],
  },
  // ───────── ชื่อเสียง / ตบหน้า ─────────
  {
    id: "hunter.bully_returns",
    minAge: 19,
    maxAge: 35,
    weight: (l) => (P(l) ? 8 : 0),
    prepare: (l) => ({ r: clamp(randInt(l, 2, 4), 0, 8), name: shortName(l.people.find((p) => p.relation === "rival") ?? createPerson(l, "rival", { age: l.age + 1, bond: 10 })) }),
    text: (l, c) => `${c.name} คนที่เคยแกล้งคุณสมัยเรียน ตอนนี้ตื่นพลังเป็นแรงก์ ${rankName(Number(c.r))} เดินมาหัวเราะเยาะ "อ้าว แรงก์ ${rankName(rank(l))} อย่างแกยังกล้าเป็น Hunter อีกเหรอ?"`,
    choices: [
      {
        label: "ยิ้ม แล้วปล่อยออร่าออกมาเงียบๆ",
        show: (l, c) => rank(l) > Number(c.r),
        tone: "special",
        run: (l, c) => { addFame(l, 8); addStat(l, "happiness", 15); return good(`ขาของ${c.name}สั่นจนทรุดลงกับพื้น ทั้งร้านกาแฟเงียบกริบ คลิปนี้มียอดวิวสิบล้าน`); },
      },
      {
        label: "ท้าประลองที่สนามฝึกของสมาคม",
        tone: "danger",
        odds: (l, c) => fightOdds(l, Number(c.r)),
        run: (l, c, ok) => {
          if (ok) { addFame(l, 10); addStat(l, "happiness", 12); return good(`คุณล้ม${c.name}ในสามกระบวนท่า เขาก้มหัวขอโทษต่อหน้าทุกคน`); }
          addStat(l, "happiness", -10); return bad("คุณแพ้... และเขาก็หัวเราะดังกว่าเดิม" + damage(l, 5, 12, "บาดเจ็บจากการประลอง"));
        },
      },
      { label: "ไม่สนใจ เดินผ่านไป", run: (l) => { addStat(l, "happiness", -3); return meh("คำพูดของเขายังก้องอยู่ในหัวคุณทั้งวัน"); } },
    ],
  },
  {
    id: "hunter.interview",
    minAge: 18,
    maxAge: 70,
    maxTimes: 3,
    weight: (l) => (P(l) && (rank(l) >= 4 || l.fame >= 30) ? 10 : 0),
    text: () => "รายการทอล์กโชว์ช่องใหญ่ขอเชิญคุณไปออกรายการ \"Hunter ที่คนไทยอยากรู้จักที่สุด\"",
    choices: [
      { label: "ไปออกรายการ", check: { stat: "looks", dc: 55 }, run: (l, _c, ok) => (ok ? (addFame(l, 12), addMoney(l, 200_000), good("คุณตอบคำถามได้น่ารักจนติดเทรนด์อันดับ 1")) : (addFame(l, -5), bad("คุณพูดผิดว่ามอนสเตอร์ \"น่าสงสาร\" ทัวร์ลงทั้งคืน"))) },
      { label: "ปฏิเสธ", run: () => meh("ความลึกลับทำให้คนยิ่งอยากรู้จักคุณ") },
    ],
  },
  {
    id: "hunter.sponsor",
    minAge: 18,
    maxAge: 60,
    maxTimes: 2,
    weight: (l) => (P(l) && rank(l) >= 3 && l.fame >= 10 ? 8 : 0),
    prepare: (l) => ({ brand: pick(l, ["เครื่องดื่มชูกำลังกระทิงฟ้า", "รองเท้าวิ่งยี่ห้อดัง", "แอปธนาคาร", "บะหมี่กึ่งสำเร็จรูป"]), amt: (rank(l) + 1) * 500_000 }),
    text: (_l, c) => `${c.brand} ขอให้คุณเป็นพรีเซนเตอร์ ค่าตัว ${formatMoney(Number(c.amt))}`,
    choices: [
      { label: "รับงาน", run: (l, c) => { addMoney(l, Number(c.amt)); addFame(l, 5); return good("ป้ายบิลบอร์ดหน้าคุณขึ้นทั่วกรุงเทพฯ"); } },
      { label: "ไม่รับ", run: () => meh("ผู้จัดการคุณถอนหายใจยาว") },
    ],
  },
  {
    id: "hunter.fan_meet",
    minAge: 18,
    maxAge: 60,
    maxTimes: 2,
    weight: (l) => (P(l) && l.fame >= 40 ? 8 : 0),
    text: () => "แฟนคลับนับพันมารอคุณที่สนามบิน มีป้ายไฟชื่อคุณเต็มไปหมด",
    choices: [
      { label: "แจกลายเซ็นทุกคน", run: (l) => { addFame(l, 5); addStat(l, "happiness", 10); addStat(l, "health", -2); return good("มือคุณแทบหลุด แต่หัวใจพองโต"); } },
      { label: "เดินผ่านไปแบบเท่ๆ", run: (l) => { addFame(l, 2); return meh("แฟนๆ กรี๊ดหนักกว่าเดิม \"เย็นชาแบบนี้แหละที่รัก!\""); } },
    ],
  },
  // ───────── ภัยพิบัติ / ตอนใหญ่ ─────────
  {
    id: "hunter.red_gate",
    minAge: 18,
    maxAge: 60,
    maxTimes: 2,
    weight: (l) => (isHunter(l) ? 4 : 0),
    title: "Red Gate!",
    text: () => "ระหว่างบุก Gate ธรรมดา ประตูทางออกเปลี่ยนเป็นสีแดงเลือด — คุณและทีมติดอยู่ข้างใน เวลาข้างในไหลเร็วกว่าข้างนอกหลายเท่า",
    choices: [
      {
        label: "นำทีมบุกหาบอสเพื่อเปิดประตู",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l) + 1),
        survival: (l) => survivalOdds(l, rank(l) + 1),
        run: (l, _c, ok) => {
          if (ok) { const r = gateRewards(l, rank(l) + 1, 1.5, true); addFame(l, 15); return { text: `คุณนำทีมออกจาก Red Gate ได้ทุกคน! ${r}`, kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, rank(l) + 1))) { kill(l, "ติดอยู่ใน Red Gate"); return bad("ประตูสีแดงไม่เคยเปิดออกอีกเลย"); }
          return bad("ประตูเปิดออกหลังผ่านไปหนึ่งสัปดาห์ คุณรอดมาได้แต่สภาพแทบจำไม่ได้" + damage(l, 25, 40, "บาดแผลจาก Red Gate"));
        },
      },
      {
        label: "ตั้งค่ายป้องกัน รอทีมกู้ภัย",
        check: { stat: "smarts", dc: 55 },
        run: (l, _c, ok) => (ok ? good("แผนของคุณทำให้ทุกคนรอดจนทีมกู้ภัยมาถึง") : bad("เสบียงหมดก่อนทีมกู้ภัยมาถึง" + damage(l, 15, 30, "อดอาหารใน Red Gate"))),
      },
    ],
  },
  {
    id: "hunter.dungeon_break",
    minAge: 18,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => (P(l) ? 5 : 0),
    title: "ประกาศภาวะฉุกเฉิน",
    text: () => "Gate แรงก์ A ที่ถูกปล่อยไว้นานเกินไปแตกออกกลางกรุงเทพฯ! สมาคมเรียกระดมพล Hunter ทุกคน",
    choices: [
      {
        label: "ไปแนวหน้า",
        tone: "danger",
        odds: (l) => fightOdds(l, 5),
        survival: (l) => survivalOdds(l, 5, 0.1),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 25); gainExp(l, 800); return { text: "คุณยืนอยู่แถวหน้าจนมอนสเตอร์ตัวสุดท้ายล้ม ภาพคุณเปื้อนเลือดยืนบนซากมอนสเตอร์กลายเป็นภาพประวัติศาสตร์", kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, 5, 0.1))) { kill(l, "เสียชีวิตขณะปกป้องกรุงเทพฯ จาก Dungeon Break"); return bad("ชื่อของคุณถูกสลักไว้บนอนุสรณ์ผู้กล้าที่สนามหลวง"); }
          return bad("คุณถูกหามออกจากแนวรบ" + damage(l, 20, 35, "บาดแผลจาก Dungeon Break"));
        },
      },
      { label: "อพยพประชาชน", run: (l) => { addFame(l, 8); gainExp(l, 200); return good("คุณพาคนกว่าสามร้อยคนหนีออกจากพื้นที่ได้ปลอดภัย"); } },
      { label: "แกล้งไม่ได้ยินโทรศัพท์", run: (l) => { addFame(l, -12); addStat(l, "happiness", -8); return bad("สมาคมบันทึกชื่อคุณว่าไม่ตอบรับการระดมพล ข่าวรั่วไปถึงสื่อ"); } },
    ],
  },
  {
    id: "hunter.national_raid",
    minAge: 20,
    maxAge: 60,
    maxTimes: 1,
    weight: (l) => (rank(l) >= 5 ? 12 : 0),
    title: "ภารกิจระดับชาติ",
    text: () => "Gate แรงก์ S เปิดขึ้นกลางอ่าวไทย นายกรัฐมนตรีเชิญ Hunter แรงก์สูงสุดของประเทศเข้าร่วมทีมจู่โจม รวมถึงคุณ",
    choices: [
      {
        label: "รับภารกิจ",
        tone: "danger",
        odds: (l) => fightOdds(l, 6),
        survival: (l) => survivalOdds(l, 6, 0.15),
        run: (l, _c, ok) => {
          if (ok) { const r = gateRewards(l, 6, 1, true); addFame(l, 40); return { text: `🌊 ราชามังกรทะเลถูกปราบ! คุณกลายเป็นวีรบุรุษของชาติ ${r}`, kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, 6, 0.15))) { kill(l, "เสียชีวิตในภารกิจระดับชาติที่อ่าวไทย"); return bad("ทะเลกลืนร่างของคุณไป ทั้งประเทศไว้อาลัยสามวัน"); }
          return bad("ภารกิจล้มเหลว คุณรอดมาได้แต่ต้องพักฟื้นหลายเดือน" + damage(l, 25, 45, "บาดแผลจากภารกิจระดับชาติ"));
        },
      },
      { label: "ปฏิเสธ (ยังไม่พร้อม)", run: (l) => { addFame(l, -8); return meh("Hunter แรงก์ S จากญี่ปุ่นมาเคลียร์แทน และได้เครดิตไปทั้งหมด"); } },
    ],
  },
  {
    id: "hunter.betrayal",
    minAge: 19,
    maxAge: 50,
    maxTimes: 1,
    weight: (l) => (isHunter(l) ? 5 : 0),
    prepare: (l): Ctx => {
      // ถ้าจำได้จากชาติก่อน คนทรยศคือคนเดิม
      const remembered = remembers(l, "betrayal")?.data?.name;
      if (remembered) return { name: String(remembered) };
      const p = createPerson(l, "rival", { age: l.age + randInt(l, 0, 8), bond: 0 });
      observe(l, "betrayal", `อายุ ${l.age}: หัวหน้าทีม${shortName(p)}ผลักคุณไปเป็นเหยื่อล่อในดันเจี้ยน`, { name: shortName(p) });
      return { id: p.id, name: shortName(p) };
    },
    title: "การทรยศ",
    text: (_l, c) => `กลางดันเจี้ยน หัวหน้าทีม${c.name}ผลักคุณไปข้างหน้าฝูงมอนสเตอร์ "ขอโทษนะ ต้องมีคนเป็นเหยื่อล่อ"`,
    choices: [
      {
        label: (l, c) => `[ความทรงจำ] รู้ทันอยู่แล้ว — หลบแล้วผลัก${c.name}ไปแทน (อนาคตยังตรง ${Math.round(memoryOdds(l) * 100)}%)`,
        tone: "special",
        show: (l) => !!remembers(l, "betrayal"),
        run: (l, c) => {
          if (useMemory(l, 8)) {
            addFame(l, 10);
            l.flags.revenge = true;
            return { text: `คุณก้าวหลบในจังหวะเดียวกับชาติก่อนเป๊ะ ${c.name}เสียหลักล้มลงกลางฝูงมอนสเตอร์ ใบหน้าตกตะลึงนั้น… คุณรอมันมาทั้งชาติ`, kind: "milestone" };
          }
          return bad(`${c.name}ไม่ได้ผลักคุณเหมือนครั้งก่อน… เขาแทงข้างหลังแทน!` + damage(l, 15, 30, `ถูก${c.name}หักหลังในดันเจี้ยน`));
        },
      },
      {
        label: "สู้ฝ่าวงล้อม",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l) + 1),
        survival: (l) => survivalOdds(l, rank(l) + 1),
        run: (l, c, ok) => {
          l.flags.nemesis = String(c.name);
          if (ok) { gainExp(l, 600); addFame(l, 8); return good(`คุณฝ่าออกมาได้คนเดียว และเดินไปยืนตรงหน้า${c.name}ที่ทางออก เขาหน้าซีดเหมือนเห็นผี`); }
          if (!chance(l, survivalOdds(l, rank(l) + 1))) { kill(l, `ถูก${c.name}หักหลังในดันเจี้ยน`); return bad(`ภาพสุดท้ายคือรอยยิ้มของ${c.name}… ถ้ามีชาติหน้า คุณจะไม่ลืมใบหน้านี้`); }
          return bad("คุณรอดมาได้ด้วยปาฏิหาริย์" + damage(l, 25, 40, "ถูกหักหลังในดันเจี้ยน"));
        },
      },
      {
        label: "ใช้ม้วนคัมภีร์หลบหนี",
        tone: "special",
        show: (l) => !!l.power?.items.includes("ม้วนคัมภีร์หลบหนี"),
        run: (l, c) => { l.power!.items.splice(l.power!.items.indexOf("ม้วนคัมภีร์หลบหนี"), 1); l.flags.nemesis = String(c.name); return good(`แสงวาบพาคุณออกนอก Gate คุณส่งหลักฐานให้สมาคม ${c.name}ถูกถอนใบอนุญาต`); },
      },
    ],
  },
  {
    id: "hunter.friend_dies",
    minAge: 19,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (isHunter(l) && people(l, "friend").length ? 4 : 0),
    prepare: (l) => { const f = pick(l, people(l, "friend")); f.alive = false; return { name: shortName(f) }; },
    text: (_l, c) => `${c.name}ที่เพิ่งตื่นพลังเป็นแรงก์ E เข้า Gate ครั้งแรกแล้วไม่ได้กลับออกมา งานศพมีแต่เสียงร้องไห้`,
    auto: (l) => { addStat(l, "happiness", -20); return "bad"; },
  },
  // ───────── ไอเทม / ตลาดมืด ─────────
  {
    id: "hunter.black_market",
    minAge: 18,
    maxAge: 60,
    maxTimes: 2,
    weight: (l) => (P(l) ? 6 : 0),
    text: () => "ชายใส่หน้ากากในตลาดมืดใต้สะพานพระราม 8 เสนอขาย \"ยาเพิ่มพลังมานา ของแท้จากดันเจี้ยนญี่ปุ่น\" ราคา 2 ล้าน",
    choices: [
      {
        label: "ซื้อแล้วกินทันที",
        tone: "danger",
        show: (l) => l.money >= 2_000_000,
        check: { stat: "luck", dc: 55 },
        run: (l, _c, ok) => {
          addMoney(l, -2_000_000);
          if (ok) { gainExp(l, 1500); return good("มานาไหลเวียนพุ่งพล่านไปทั่วร่าง! ของแท้จริงๆ"); }
          return bad("มันคือแป้งผสมยาเบื่อหนู" + damage(l, 15, 30, "กินยาปลอมจากตลาดมืด"));
        },
      },
      { label: "ซื้อเก็บไว้เป็นไอเทม", show: (l) => l.money >= 2_000_000, run: (l) => { addMoney(l, -2_000_000); l.power!.items.push("ยาฟื้นพลังระดับสูง"); return meh("คุณเก็บขวดยาไว้ในกระเป๋ามิติ"); } },
      { label: "แจ้งสมาคม", run: (l) => { addFame(l, 4); return good("สมาคมบุกจับตลาดมืดได้ทั้งแก๊ง คุณได้รางวัลนำจับ"); } },
    ],
  },
  {
    id: "hunter.core_auction",
    minAge: 18,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => ((P(l)?.bossKills ?? 0) > 0 ? 7 : 0),
    text: () => "บริษัทวิจัยมานาขอซื้อแกนมอนสเตอร์บอสที่คุณเก็บไว้ ในราคาที่สูงผิดปกติ",
    choices: [
      { label: "ขาย", run: (l) => { const m = (rank(l) + 1) * randInt(l, 200, 600) * 1000; addMoney(l, m); return good(`คุณขายได้ ${formatMoney(m)}`); } },
      { label: "เอาไปหลอมเป็นอาวุธ", run: (l) => { l.power!.items.push("แหวนมานา"); return good("ช่างตีอาวุธหลอมแกนเป็นแหวนมานาให้คุณ"); } },
    ],
  },
  {
    id: "hunter.rank_pill_scam",
    minAge: 18,
    maxAge: 60,
    weight: (l) => (P(l) && rank(l) <= 2 ? 6 : 0),
    text: () => "โพสต์ขายของในกลุ่ม Hunter: \"ยาเลื่อนแรงก์ F→C ภายใน 7 วัน รีวิวเพียบ! 199,000 บาท\"",
    choices: [
      { label: "สั่งซื้อ", run: (l) => { addMoney(l, -199_000); addStat(l, "happiness", -8); return bad("ได้วิตามินซีมาหนึ่งกระปุก ร้านปิดเพจหนีไปแล้ว"); } },
      { label: "แคปหน้าจอไปประจานในกลุ่ม", run: (l) => { addFame(l, 2); return good("โพสต์คุณได้ยอดแชร์เพียบ มีคนรอดจากการโดนหลอกอีกหลายร้อย"); } },
    ],
  },
  // ───────── ความสัมพันธ์ ─────────
  {
    id: "hunter.teammate_love",
    minAge: 18,
    maxAge: 45,
    weight: (l) => (isHunter(l) && !people(l, "partner").length && !people(l, "spouse").length ? 7 : 0),
    prepare: (l) => ({ cls: classById(pick(l, ["healer", "sword", "mage", "tank"] as HunterClass[])).name }),
    text: (_l, c) => `${c.cls}ในทีมของคุณคอยเดินอยู่ข้างๆ ทุกครั้งที่เข้า Gate และเมื่อวานเขา/เธอกระโดดรับการโจมตีแทนคุณ`,
    choices: [
      {
        label: "ชวนไปกินข้าวหลังภารกิจ",
        check: { stat: "looks", dc: 45 },
        run: (l, _c, ok) => {
          if (ok) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -3, 3), bond: 70, job: "Hunter" }); return good(`💕 คุณกับ${shortName(p)}เริ่มคบกัน ทั้งทีมแซวทุกครั้งที่เข้า Gate`); }
          return meh("เขา/เธอบอกว่า \"ขอโฟกัสที่การเป็น Hunter ก่อน\"");
        },
      },
      { label: "แค่ขอบคุณ", run: () => meh("ความรู้สึกบางอย่างก่อตัวขึ้นแล้วก็จางหายไป") },
    ],
  },
  {
    id: "hunter.family_awakens",
    minAge: 16,
    maxAge: 50,
    weight: (l) => (people(l, "sibling").some((s) => s.age >= 18 && s.age <= 22) ? 5 : 0),
    prepare: (l) => ({ name: shortName(pick(l, people(l, "sibling").filter((s) => s.age >= 18 && s.age <= 22))), r: rankName(randInt(l, 0, 4)) }),
    text: (_l, c) => `${c.name}พี่น้องของคุณตื่นพลังเป็นแรงก์ ${c.r}! ทั้งบ้านจัดหมูกระทะฉลองทั้งคืน`,
    auto: (l) => { addStat(l, "happiness", l.power ? 6 : -2); return "good"; },
  },
  // ───────── การเติบโต ─────────
  {
    id: "hunter.reassessment",
    minAge: 19,
    maxAge: 50,
    maxTimes: 2,
    weight: (l) => (P(l) && rank(l) <= 3 && (P(l)?.level ?? 0) >= 10 ? 6 : 0),
    text: () => "สมาคมประกาศรับสมัครตรวจวัดแรงก์ใหม่ประจำปี ค่าธรรมเนียม 50,000 บาท",
    choices: [
      {
        label: "สมัครตรวจ",
        check: { stat: "luck", dc: 75, bonus: (l) => (l.power?.level ?? 0) / 200 },
        run: (l, _c, ok) => {
          addMoney(l, -50_000);
          if (ok) { rankUp(l, "[ระบบ] ผลตรวจวัดใหม่"); return { text: "เข็มวัดพุ่งขึ้นจนเจ้าหน้าที่ต้องเคาะเครื่อง", kind: "milestone" }; }
          return meh("ผลเหมือนเดิมทุกตัวเลข เจ้าหน้าที่ยิ้มให้อย่างเห็นใจ");
        },
      },
      { label: "ไม่ตรวจ", run: () => meh("คุณเก็บเงินห้าหมื่นไว้กินหมูกระทะ") },
    ],
  },
  {
    id: "hunter.hidden_quest",
    minAge: 18,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (hasTalent(l, "system_user") && (P(l)?.level ?? 0) >= 20 ? 30 : 0),
    system: true,
    title: "ภารกิจลับ",
    text: () => "[ระบบ] ภารกิจเปลี่ยนสายอาชีพถูกเปิดใช้งาน — เอาชีวิตรอดจากอัศวินเงาจำนวนไม่จำกัดเป็นเวลา 1 ชั่วโมง\nรางวัล: ???\nบทลงโทษหากล้มเหลว: ความตาย",
    choices: [
      {
        label: "ยอมรับภารกิจ",
        tone: "danger",
        odds: (l) => survivalOdds(l, rank(l) + 1),
        survival: (l) => survivalOdds(l, rank(l) + 1),
        run: (l, _c, ok) => {
          if (!ok) { kill(l, "ล้มเหลวในภารกิจลับของระบบ"); return bad("[ระบบ] ภารกิจล้มเหลว — กำลังดำเนินการลงโทษ"); }
          l.power!.hunterClass = "summoner";
          l.power!.skills.push("ราชาแห่งเงา");
          rankUp(l, "[ระบบ] เปลี่ยนสายอาชีพสำเร็จ");
          return { text: "เงาทุกตัวคุกเข่าลงต่อหน้าคุณ — คุณกลายเป็น 'ผู้อัญเชิญเงา' สายอาชีพที่ไม่มีใครในโลกเคยมี", kind: "milestone" };
        },
      },
      { label: "ปฏิเสธ", run: () => ({ text: "[ระบบ] ไม่สามารถปฏิเสธภารกิจนี้ได้ — ภารกิจจะถูกนำเสนออีกครั้งในอนาคต", kind: "system" }) },
    ],
  },
  {
    id: "hunter.mana_overload",
    minAge: 25,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => (isHunter(l) && (P(l)?.gates ?? 0) > 15 ? 5 : 0),
    text: () => "หมอสมาคมเตือนว่าเส้นมานาของคุณเริ่มอักเสบจากการบุก Gate ถี่เกินไป",
    choices: [
      { label: "พักหนึ่งปี", run: (l) => { addStat(l, "health", 12); addStat(l, "happiness", 5); l.doneThisYear.push("gate", "gate", "gate"); return good("คุณพักฟื้นที่เชียงใหม่ ร่างกายกลับมาแข็งแรง"); } },
      { label: "ช่างมัน ลุยต่อ", run: (l) => { addStat(l, "health", -12); return bad("มือคุณสั่นเล็กน้อยทุกเช้าหลังจากนั้น"); } },
    ],
  },
  {
    id: "hunter.retire_thought",
    minAge: 45,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => (isHunter(l) ? 8 : 0),
    text: (l) => `คุณเป็น Hunter มา ${l.age - (l.power?.awakenedAt ?? l.age)} ปีแล้ว ร่างกายเริ่มฟื้นตัวช้ากว่าเดิม รุ่นน้องเก่งขึ้นทุกปี`,
    choices: [
      { label: "แขวนดาบ เกษียณ", run: (l) => { l.job = undefined; addStat(l, "happiness", 10); return good("คุณประกาศเกษียณ งานเลี้ยงอำลามีรุ่นน้องมาร่วมหลายร้อยคน"); } },
      { label: "เป็นครูฝึกให้รุ่นน้อง", run: (l) => { addFame(l, 5); addStat(l, "happiness", 6); return good("คุณย้ายไปสอนที่โรงเรียน Hunter ศิษย์ของคุณหลายคนกลายเป็นแรงก์ A"); } },
      { label: "ลุยต่อจนกว่าจะไม่ไหว", run: () => meh("ดาบของคุณยังคม และใจคุณยังไม่ยอมแพ้") },
    ],
  },
  // ───────── คนธรรมดาในโลก Hunter ─────────
  {
    id: "mundane.porter_double",
    minAge: 18,
    maxAge: 60,
    maxTimes: 1,
    weight: (l) => (l.job?.careerId === "porter" ? 10 : 0),
    title: "ดันเจี้ยนคู่",
    text: () =>
      "Gate แรงก์ D ธรรมดาๆ มีห้องลับซ่อนอยู่ ประตูปิดลงข้างหลังทีม รูปปั้นเทพเจ้ายักษ์ตรงกลางห้องยิ้มให้… " +
      "ศิลาจารึกเขียนว่า \"จงบูชา จงสรรเสริญ จงพิสูจน์ศรัทธา\"",
    choices: [
      {
        label: "สังเกตกฎของห้องให้ดี แล้วทำตาม",
        tone: "danger",
        check: { stat: "smarts", dc: 65 },
        survival: (l) => clamp(0.35 + (l.stats.smarts - 50) / 150 + (l.stats.luck - 50) / 300, 0.1, 0.9),
        run: (l, c, ok) => {
          if (!ok && !chance(l, 0.4)) { kill(l, "ติดอยู่ในดันเจี้ยนคู่"); return bad("รูปปั้นลืมตาขึ้นพร้อมกัน…"); }
          if (!ok) return bad("คุณเป็นหนึ่งในไม่กี่คนที่รอดออกมา แต่ไม่มีอะไรเปลี่ยนไป" + damage(l, 20, 40, "ดันเจี้ยนคู่"));
          c.rank = Math.max(rollAwakening(l, 1), 0);
          c.offer = offerClasses(l).join(",");
          return { text: "คุณเป็นคนสุดท้ายที่ยังหายใจอยู่ในห้อง… แล้วหน้าต่างสีฟ้าก็เด้งขึ้นตรงหน้า", kind: "system", next: "reawaken" };
        },
      },
      { label: "วิ่งไปที่ประตูแล้วทุบสุดแรง", check: { stat: "luck", dc: 60 }, run: (l, _c, ok) => (ok ? meh("ประตูแง้มออกพอดี คุณหนีออกมาได้คนเดียว และไม่กล้าเข้า Gate อีกเลย") : (kill(l, "ติดอยู่ในดันเจี้ยนคู่"), bad("ประตูไม่ขยับแม้แต่นิดเดียว"))) },
    ],
    scenes: {
      reawaken: {
        system: true,
        title: "ผู้เล่นคนใหม่",
        text: (_l, c) => `[ระบบ] คุณมีคุณสมบัติเป็น "ผู้เล่น" — แรงก์: 【${rankName(Number(c.rank))}】 กรุณาเลือกสายอาชีพ`,
        choices: classChoices((l, c, cls) => {
          awaken(l, Number(c.rank), cls);
          l.job = undefined;
          openHiddenSlot(l, "ตื่นพลังครั้งที่สอง");
          return { text: `⚡ คนแบกของที่ทุกคนมองข้าม ตื่นพลังเป็น ${classById(cls).name} แรงก์ ${rankName(Number(c.rank))}!`, kind: "milestone" };
        }),
      },
    },
  },
  {
    id: "mundane.late_awaken",
    minAge: 21,
    maxAge: 45,
    maxTimes: 1,
    weight: (l) => (mundaneAdult(l) ? (l.flags.stubborn ? 0.12 : 0.03) : 0),
    title: "การตื่นพลังช่วงหลัง",
    text: () => "เช้านี้คุณตื่นมาพร้อมเสียงหึ่งในหู แก้วน้ำบนโต๊ะสั่นเอง… หมอที่สมาคมบอกว่าเป็นเคสหายาก \"การตื่นพลังช่วงหลัง\"",
    choices: [
      {
        label: "เข้ารับการประเมิน",
        run: (l, c) => {
          c.rank = Math.max(rollAwakening(l, 0), 0);
          c.offer = offerClasses(l).join(",");
          return { text: "เครื่องวัดส่งเสียงปี๊บ…", kind: "system", next: "pick" };
        },
      },
    ],
    scenes: {
      pick: {
        system: true,
        text: (_l, c) => `[ระบบ] แรงก์ประเมิน: 【${rankName(Number(c.rank))}】 กรุณาเลือกสายอาชีพ`,
        choices: classChoices((l, c, cls) => {
          awaken(l, Number(c.rank), cls);
          return { text: `⚡ คุณตื่นพลังเป็น ${classById(cls).name} แรงก์ ${rankName(Number(c.rank))} ในวัย ${l.age} ปี!`, kind: "milestone" };
        }),
      },
    },
  },
  {
    id: "mundane.friend_awakened",
    minAge: 18,
    maxAge: 25,
    weight: (l) => (mundaneAdult(l) && people(l, "friend").length ? 8 : 0),
    prepare: (l) => ({ name: shortName(pick(l, people(l, "friend"))) }),
    text: (_l, c) => `${c.name}เพื่อนสนิทตื่นพลังแรงก์ B ได้เซ็นสัญญากับกิลด์ใหญ่ทันที ตอนนี้ไม่ค่อยว่างคุยกับคุณแล้ว`,
    choices: [
      { label: "ยินดีด้วยจากใจจริง", run: (l) => { addStat(l, "happiness", 2); return good("เขาส่งรูปจากในดันเจี้ยนมาให้คุณดูบ่อยๆ"); } },
      { label: "อิจฉาจนนอนไม่หลับ", run: (l) => { addStat(l, "happiness", -8); return bad("คุณเปิดดูคลิปของเขาซ้ำไปซ้ำมาทั้งคืน"); } },
    ],
  },
  {
    id: "mundane.gate_tour",
    minAge: 12,
    maxAge: 80,
    weight: (l) => (!l.power ? 4 : 0),
    text: () => "บริษัททัวร์จัดทริป \"เดินชม Gate ที่ถูกเคลียร์แล้ว\" ราคา 3,500 บาท รวมรูปถ่ายกับซากมอนสเตอร์",
    choices: [
      { label: "ไปเที่ยว", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => { addMoney(l, -3500); if (ok) { addStat(l, "happiness", 8); return good("สนุกมาก! คุณได้ถ่ายรูปกับเขาของมังกรน้อยด้วย"); } addStat(l, "happiness", -4); return bad("ไกด์ชี้ให้ดูก้อนหินสองชั่วโมง แล้วก็พากลับ"); } },
      { label: "ไม่ไป", run: () => meh("คุณดูคลิปรีวิวใน YouTube แทน") },
    ],
  },
];
