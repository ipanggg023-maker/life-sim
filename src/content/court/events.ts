import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, openHiddenSlot } from "../../engine/game";
import { memoryOdds, observe, remembers, useMemory } from "../../engine/memory";
import { chance, pick, randInt } from "../../engine/rng";
import type { HunterClass, Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, displayName, firstPerson, money, people, shortName } from "../../engine/util";
import { CLASSES, awaken, classById, fightOdds, gainExp, guildById, offerClasses, rankLabel, rankUp, rollAwakening, survivalOdds } from "../hunter/power";
import { worldFacts } from "../hunter/worldFacts";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });
const sys = (text: string, next?: string): Outcome => ({ text, kind: "system", next });

const NOVEL = "ดอกกุหลาบแห่งจักรวรรดิ";
const rank = (l: Life) => l.power?.rank ?? -1;
const noble = (l: Life) => l.wealth !== "poor";
const single = (l: Life) => !people(l, "partner").length && !people(l, "spouse").length;

/** คู่หมั้นในนิยาย (ราชวงศ์) */
const royal = (l: Life) => (l.gender === "f" ? "องค์รัชทายาทคาเลียน" : "องค์หญิงเซราฟิน่า");
/** ตัวเอกของนิยายต้นฉบับ */
const hero = (l: Life) => (l.gender === "f" ? "ลิเซีย" : "ลิออน");
const north = (l: Life) => (l.gender === "f" ? "ดยุกคาสเซียนแห่งทิศเหนือ" : "แกรนด์ดัชเชสเอเวลีนแห่งทิศเหนือ");
const role = (l: Life) => String(l.flags.role ?? "");
const isVillain = (l: Life) => role(l) === "villain";
const broken = (l: Life) => Number(l.flags.dfBroken ?? 0);
const breakFlag = (l: Life) => { l.flags.dfBroken = broken(l) + 1; };
const followFlag = (l: Life) => { l.flags.dfFollowed = Number(l.flags.dfFollowed ?? 0) + 1; };
const RL = rankLabel;

function damage(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

const COURT_STYLES: HunterClass[] = CLASSES.filter((c) => c.world === "court").map((c) => c.id);

function styleChoices(onPick: (l: Life, c: Ctx, id: HunterClass) => Outcome) {
  return COURT_STYLES.map((id) => ({
    label: `${classById(id).emoji} ${classById(id).name} — ${classById(id).desc}`,
    tone: id === "c_dark" ? ("special" as const) : undefined,
    show: (_l: Life, c: Ctx) => String(c.offer ?? "").split(",").includes(id),
    run: (l: Life, c: Ctx) => onPick(l, c, id),
  }));
}

// ───────────────────────── ความทรงจำจากโลกเก่า: รู้ว่าตัวเองอยู่ในนิยาย ─────────────────────────

const AWAKEN_MEMORY: GameEvent = {
  id: "court.novel",
  minAge: 7,
  maxAge: 7,
  forced: true,
  title: "ความทรงจำที่ไหลบ่า",
  text: () =>
    `คุณสะดุดชายกระโปรงตกบันไดหินอ่อน หัวฟาดพื้นเสียงดัง… ภาพจากอีกโลกหนึ่งไหลเข้ามาในหัว — ตึกสูง โทรศัพท์มือถือ และนิยายเรื่อง "${NOVEL}" ที่คุณเคยอ่านจบในคืนเดียว`,
  choices: [
    {
      label: "ลุกขึ้นไปส่องกระจก",
      run: (l): Outcome => {
        const r = l.wealth === "elite" || l.wealth === "rich" ? "villain" : l.wealth === "middle" ? (chance(l, 0.4) ? "villain" : "extra") : chance(l, 0.3) ? "lead" : "extra";
        l.flags.role = r;
        if (r === "villain") {
          return sys(
            `ใบหน้าในกระจกคือ ${displayName(l)} — ${l.gender === "f" ? "คุณหนูตัวร้าย" : "คุณชายตัวร้าย"}ในนิยาย ผู้ถูก${royal(l)}ถอนหมั้นต่อหน้าทุกคน แล้วถูกประหารด้วยกิโยตินในวันเกิดอายุ 20 ปี\n[Death Flag ×3 รออยู่ข้างหน้า]`,
          );
        }
        if (r === "lead") return sys(`ใบหน้าในกระจกคือ ${hero(l)}… ไม่สิ ชื่อคุณคือ ${displayName(l)} แต่ชะตาชีวิตเหมือนตัวเอกของนิยายทุกประการ — เด็กสามัญชนที่จะตื่นพลังศักดิ์สิทธิ์ตอนอายุ 15`);
        return sys(`คุณค้นความทรงจำจนทั่ว… ไม่มีชื่อ ${displayName(l)} ในนิยายเลย คุณเป็นแค่ตัวประกอบ — ซึ่งในบทที่ 3 ตัวประกอบทั้งเมืองตายในเทศกาลดอกไม้`);
      },
    },
  ],
};

// ───────────────────────── พิธีตรวจพลังเวท (เทียบเท่าวันตื่นพลัง) ─────────────────────────

function assess(l: Life, c: Ctx, bonus: number) {
  c.rank = rollAwakening(l, bonus);
  c.offer = offerClasses(l).join(",");
}

const ASSESSMENT: GameEvent = {
  id: "court.assessment",
  minAge: 9,
  maxAge: 12,
  forced: true,
  when: (l) => !l.power && !l.flags.awakenDone && l.age === Number(l.flags.awakenAge ?? 10),
  title: "พิธีตรวจพลังเวท",
  text: () => "เด็กอายุสิบปีทุกคนในจักรวรรดิต้องมาวางมือบนลูกแก้วมานาที่วิหารใหญ่ บาทหลวงเรียกชื่อคุณแล้ว",
  choices: [
    { label: "หลับตา แล้ววางมืออย่างมั่นใจ", check: { stat: "smarts", dc: 50 }, run: (l, c, ok) => { assess(l, c, ok ? 1 : 0); return meh(ok ? "ลูกแก้วสั่นไหวใต้ฝ่ามือ" : "ลูกแก้วเย็นเฉียบ…", Number(c.rank) < 0 ? "none" : "style"); } },
    { label: "ภาวนาต่อเทพธิดา", check: { stat: "luck", dc: 50 }, run: (l, c, ok) => { assess(l, c, ok ? 1 : 0); return meh(ok ? "แสงจากกระจกสีส่องลงมาที่คุณพอดี" : "ไม่มีอะไรเกิดขึ้นในทันที…", Number(c.rank) < 0 ? "none" : "style"); } },
  ],
  scenes: {
    none: {
      title: "ไร้พลังเวท",
      text: () => "ลูกแก้วไม่เรืองแสงแม้แต่น้อย บาทหลวงจดลงสมุดว่า 'ไร้มานา' เสียงกระซิบดังไปทั่ววิหาร",
      choices: [
        { label: "ไม่เป็นไร ในนิยายตัวละครที่เก่งที่สุดใช้สมอง", run: (l) => { l.flags.awakenDone = true; addStat(l, "smarts", 3); return meh("คุณเดินออกจากวิหารพร้อมรอยยิ้ม พ่อแม่มองคุณอย่างแปลกใจ"); } },
        { label: "ร้องไห้ทั้งคืน", run: (l) => { l.flags.awakenDone = true; addStat(l, "happiness", -10); return bad("หมอนเปียกไปทั้งใบ"); } },
      ],
    },
    style: {
      system: true,
      title: "พลังเวทตื่นขึ้น",
      text: (l, c) => `[ระบบ] ลูกแก้วเปล่งแสง! ระดับพลังเวท:【${RL(l, Number(c.rank))}】 กรุณาเลือกเส้นทาง`,
      choices: styleChoices((l, c, id) => {
        const r = Number(c.rank);
        awaken(l, r, id);
        if (id === "c_dark") addFame(l, -10);
        openHiddenSlot(l, "พลังเวทตื่น");
        return { text: `✨ คุณเริ่มเส้นทาง${classById(id).name} ด้วยพลังระดับ${RL(l, r)}`, kind: "milestone" };
      }),
    },
  },
};

// ───────────────────────── Death Flag ของตัวร้าย ─────────────────────────

const VILLAIN: GameEvent[] = [
  {
    id: "court.df1",
    minAge: 12,
    maxAge: 12,
    forced: true,
    when: isVillain,
    title: "Death Flag 1: การพบกันครั้งแรก",
    text: (l) => `วันเปิดภาคเรียนที่สถาบันจักรวรรดิ ${hero(l)} สามัญชนผู้ได้ทุนสะดุดล้มตรงหน้าคุณพอดี — ในนิยาย นี่คือฉากที่ตัวร้ายเหยียบชายกระโปรงนางแล้วหัวเราะเยาะ`,
    choices: [
      { label: "ยื่นมือช่วยพยุงขึ้น", run: (l) => { breakFlag(l); const p = createPerson(l, "friend", { gender: l.gender === "f" ? "f" : "m", age: l.age, bond: 60 }); p.name = hero(l); return sys(`${hero(l)}มองคุณอย่างตกตะลึง ก่อนยิ้มกว้าง [Death Flag 1 ถูกหัก]`); } },
      { label: "เดินอ้อมไปเฉยๆ ไม่ข้องเกี่ยว", check: { stat: "luck", dc: 45 }, run: (l, _c, ok) => { if (ok) { breakFlag(l); return sys("คุณผ่านไปโดยไม่มีใครสังเกต [Death Flag 1 ถูกหัก]"); } followFlag(l); return bad("ชายเสื้อคุณไปเกี่ยวนางล้มซ้ำ ทุกคนหันมามองคุณเหมือนคนใจร้าย… ชะตาพยายามบังคับให้เป็นไปตามบท"); } },
      { label: "เล่นตามบท: หัวเราะเยาะ", run: (l) => { followFlag(l); addFame(l, 2); return bad("ทุกคนเกรงกลัวคุณ… และเส้นทางสู่กิโยตินก็ชัดเจนขึ้นอีกก้าว"); } },
    ],
  },
  {
    id: "court.df2",
    minAge: 16,
    maxAge: 16,
    forced: true,
    when: isVillain,
    title: "Death Flag 2: งานเปิดตัวสังคม",
    text: (l) => `งานเต้นรำเปิดตัวสังคม ${royal(l)}คู่หมั้นของคุณเดินผ่านคุณไปขอ${hero(l)}เต้นรำเป็นคนแรก ทั้งห้องโถงหันมาจ้องคุณ — ในนิยาย คุณสาดไวน์ใส่${hero(l)}ตรงนี้`,
    choices: [
      { label: `ขอถอนหมั้นเองต่อหน้าจักรพรรดิ`, check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { if (ok) { breakFlag(l); l.flags.engagementOff = true; addFame(l, 8); return sys(`"กระหม่อมขอคืนอิสระให้${royal(l)}" — เสียงฮือฮาดังทั่วห้องโถง จักรพรรดิหัวเราะชอบใจ [Death Flag 2 ถูกหัก]`); } followFlag(l); addFame(l, -8); return bad("คำพูดออกมาผิดจังหวะ ฟังเหมือนประชดประชัน ทุกคนมองคุณเป็นตัวร้ายมากกว่าเดิม"); } },
      { label: (l) => `ขอ${north(l)}เต้นรำแทน`, check: { stat: "looks", dc: 60 }, run: (l, _c, ok) => { if (ok) { breakFlag(l); l.flags.northInterest = true; return sys(`${north(l)}ผู้ไม่เคยเต้นรำกับใคร ยื่นมือมาจับมือคุณ ทั้งห้องโถงเงียบกริบ [Death Flag 2 ถูกหัก]`); } return meh("อีกฝ่ายมองคุณนิ่งๆ แล้วเดินจากไป… อย่างน้อยคุณก็ไม่ได้สาดไวน์ใส่ใคร"); } },
      { label: "เล่นตามบท: สาดไวน์", run: (l) => { followFlag(l); addFame(l, -12); addStat(l, "happiness", 5); return bad(`ไวน์แดงเปื้อนชุดขาวของ${hero(l)} เสียงกรีดร้องดังทั่วห้อง… สะใจนิดหน่อย แต่กิโยตินใกล้เข้ามาอีกก้าว`); } },
    ],
  },
  {
    id: "court.df3",
    minAge: 18,
    maxAge: 18,
    forced: true,
    when: isVillain,
    title: "Death Flag 3: คดีวางยาพิษ",
    text: (l) => `${hero(l)}ล้มลงกลางงานน้ำชาของจักรพรรดินี หลักฐานทุกชิ้นชี้มาที่คุณ — ทั้งที่คุณไม่ได้ทำอะไรเลย ทหารองครักษ์กำลังมุ่งหน้ามาจับกุม`,
    choices: [
      { label: "สืบหาคนร้ายตัวจริงด้วยตัวเอง", check: { stat: "smarts", dc: 60, bonus: (l) => broken(l) * 0.05 }, run: (l, _c, ok) => { if (ok) { breakFlag(l); addFame(l, 15); return sys("คุณพบว่าสาวใช้ของเคานต์เตสคู่แข่งเป็นคนลงมือ และนำหลักฐานไปยื่นต่อหน้าจักรพรรดิด้วยตัวเอง [Death Flag 3 ถูกหัก]"); } followFlag(l); return bad("หลักฐานของคุณไม่หนักแน่นพอ คุณถูกจับขังในหอคอยรอการพิจารณาคดี"); } },
      { label: (l) => `ใช้พลังศักดิ์สิทธิ์ถอนพิษให้${hero(l)}`, tone: "special", show: (l) => l.power?.hunterClass === "c_holy", run: (l) => { breakFlag(l); addFame(l, 25); return sys(`แสงสีทองแผ่จากมือคุณ ${hero(l)}ลืมตาขึ้น ทั้งราชสำนักคุกเข่า — ตัวร้ายในนิยายกลายเป็นนักบุญ [Death Flag 3 ถูกหัก]`); } },
      { label: "หนีออกจากเมืองหลวงทันที", run: (l) => { breakFlag(l); l.flags.exiled = true; addMoney(l, -Math.round(Math.max(0, l.money) / 2)); addFame(l, -20); return sys("คุณปีนกำแพงคฤหาสน์หนีไปพร้อมเงินครึ่งเดียว ชื่อคุณถูกประกาศจับ… แต่หัวยังอยู่บนบ่า [Death Flag 3 ถูกหัก]"); } },
      { label: "ยอมให้จับ", run: (l) => { followFlag(l); return bad("โซ่ตรวนเย็นเฉียบรัดข้อมือ… ทุกอย่างกำลังเป็นไปตามบทนิยาย"); } },
    ],
  },
  {
    id: "court.fate_free",
    minAge: 20,
    maxAge: 20,
    forced: true,
    when: (l) => isVillain(l) && (broken(l) >= 2 || !!l.flags.exiled),
    system: true,
    text: () => "[ระบบ] วันที่นิยายบอกว่าคุณจะถูกประหาร… ผ่านไปอย่างเงียบสงบ ไม่มีกิโยติน ไม่มีฝูงชน มีแค่ท้องฟ้าสีครามและเสียงนกร้อง — คุณหักชะตาของตัวร้ายได้สำเร็จ",
    auto: (l) => { l.flags.fateDefied = true; addStat(l, "happiness", 30); addFame(l, 10); },
  },
  {
    id: "court.execution",
    minAge: 20,
    maxAge: 20,
    forced: true,
    when: (l) => isVillain(l) && broken(l) < 2 && !l.flags.exiled,
    title: "ลานประหาร",
    text: (l) => `วันเกิดอายุ 20 ของคุณ… ตามบทนิยายทุกตัวอักษร คุณถูกพาตัวขึ้นลานประหารกลางจัตุรัส ฝูงชนตะโกนสาปแช่ง ${royal(l)}ยืนมองอยู่ข้าง${hero(l)}`,
    choices: [
      {
        label: "ร้องขอความเมตตาต่อจักรพรรดิ",
        odds: (l) => clamp(0.2 + broken(l) * 0.25 + (l.stats.looks - 50) / 200, 0.05, 0.9),
        run: (l, _c, ok) => {
          if (ok) { l.flags.exiled = true; addFame(l, -15); return sys("จักรพรรดิยกพระหัตถ์ \"เนรเทศ\" — คุณรอดตาย แต่ต้องไปใช้ชีวิตที่ชายแดน"); }
          kill(l, "ถูกประหารด้วยกิโยตินตามบทนิยาย");
          return bad("ใบมีดตกลงมา… บทนิยายไม่เคยเปลี่ยน");
        },
      },
      {
        label: "ใช้พลังเวทแหกลานประหาร",
        tone: "danger",
        show: (l) => !!l.power,
        odds: (l) => fightOdds(l, 4),
        run: (l, _c, ok) => {
          if (ok) { l.flags.exiled = true; l.flags.fugitive = true; addFame(l, -10); return sys("โซ่ตรวนแตกกระจาย คุณหายตัวไปในพายุเวทต่อหน้าฝูงชน — ตัวร้ายที่หนีรอดจากกิโยตินคนแรกในประวัติศาสตร์"); }
          kill(l, "ถูกประหารหลังพยายามหลบหนีจากลานประหาร");
          return bad("องครักษ์จักรพรรดิสกัดเวทของคุณไว้ได้…");
        },
      },
      { label: "ยอมรับชะตา", run: (l) => { kill(l, "ถูกประหารด้วยกิโยตินตามบทนิยาย"); return bad("คุณหลับตา… บางทีชาติหน้าอาจได้เป็นตัวเอกบ้าง"); } },
    ],
  },
];

// ───────────────────────── ตัวเอก / ตัวประกอบ ─────────────────────────

const OTHER_ROLES: GameEvent[] = [
  {
    id: "court.saint",
    minAge: 15,
    maxAge: 15,
    forced: true,
    when: (l) => role(l) === "lead",
    title: "นักบุญหญิง/ชายแห่งยุค",
    text: () => "คุณกอดแมวจรที่ถูกรถม้าทับ แสงสีทองพุ่งออกจากมือคุณจนทั้งถนนสว่างวาบ แมวลุกขึ้นวิ่งได้ — ทหารวิหารวิ่งเข้ามาล้อมคุณทันที",
    choices: [
      {
        label: "ยอมเข้าวิหาร",
        run: (l) => {
          if (!l.power) { awaken(l, Math.max(2, rollAwakening(l, 2)), "c_holy"); openHiddenSlot(l, "พลังศักดิ์สิทธิ์ตื่น"); }
          else if (l.power.hunterClass !== "c_holy") rankUp(l, "พลังศักดิ์สิทธิ์ซ้อนทับเวทเดิม");
          l.power!.guild = "c_temple";
          l.flags.saint = true;
          addFame(l, 25);
          return { text: "คุณได้รับตำแหน่งผู้สมัครนักบุญ — ทุกอย่างเป็นไปตามบทของตัวเอก… รวมถึงตัวร้ายที่จะเกลียดคุณ", kind: "milestone" };
        },
      },
      { label: "วิ่งหนี ไม่อยากเป็นตัวเอก", check: { stat: "luck", dc: 55 }, run: (l, _c, ok) => (ok ? meh("คุณหนีรอดไปได้ ใช้ชีวิตธรรมดาต่อไป บทนิยายพังตั้งแต่บทแรก") : (l.flags.saint = true, addFame(l, 15), meh("ทหารวิหารจับคุณได้ที่ตรอกด้านหลัง ยังไงก็ต้องเป็นนักบุญอยู่ดี"))) },
    ],
  },
  {
    id: "court.villain_bully",
    minAge: 13,
    maxAge: 19,
    maxTimes: 2,
    weight: (l) => (role(l) === "lead" ? 15 : 0),
    text: (l) => `${l.gender === "f" ? "คุณหนูโรซาลีน" : "คุณชายเซดริก"}ตัวร้ายในนิยายเทชาร้อนใส่คุณกลางห้องอาหารของสถาบัน "สามัญชนอย่างเจ้าไม่ควรมาอยู่ที่นี่"`,
    choices: [
      { label: "ยิ้มแล้วเช็ดชาออกอย่างสง่างาม", check: { stat: "looks", dc: 50 }, run: (l, _c, ok) => (ok ? (addFame(l, 6), good("ทั้งห้องอาหารเงียบ แล้วเริ่มกระซิบชื่นชมความใจเย็นของคุณ")) : bad("ชาร้อนลวกแขน คุณร้องออกมาจนทุกคนหัวเราะ")) },
      { label: "ตอบโต้ด้วยคำพูดเจ็บแสบ", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => (ok ? (addFame(l, 8), addStat(l, "happiness", 6), good("ตัวร้ายหน้าแดงก่ำ หาคำโต้กลับไม่ได้")) : bad("คุณพูดติดอ่าง… ไม่ได้ผลเลย")) },
    ],
  },
  {
    id: "court.extra_flag",
    minAge: 17,
    maxAge: 17,
    forced: true,
    when: (l) => role(l) === "extra",
    title: "บทที่ 3: เทศกาลดอกไม้",
    text: () => "เทศกาลดอกไม้มาถึง ในนิยาย ประตูมิติปีศาจเปิดกลางจัตุรัสตอนพลุดอกแรกขึ้น และตัวประกอบทั้งจัตุรัสตาย…",
    choices: [
      { label: "ไม่ไปเทศกาล พาครอบครัวออกนอกเมือง", run: (l) => { l.flags.extraSurvived = true; addStat(l, "happiness", 5); return sys("เช้าวันต่อมา ข่าวโศกนาฏกรรมที่จัตุรัสดังไปทั่ว — คุณและครอบครัวปลอดภัย"); } },
      {
        label: "ไปเตือนผู้คนที่จัตุรัส",
        tone: "danger",
        survival: (l) => clamp(0.6 + (l.stats.luck - 50) / 150 + (l.power ? 0.2 : 0), 0.2, 0.95),
        odds: (l) => clamp(0.6 + (l.stats.luck - 50) / 150 + (l.power ? 0.2 : 0), 0.2, 0.95),
        run: (l, _c, ok) => {
          if (!ok) { kill(l, "ตายในเทศกาลดอกไม้ตามบทที่ 3 ของนิยาย"); return bad("ประตูมิติเปิดเร็วกว่าที่คุณจำได้…"); }
          l.flags.extraSurvived = true;
          addFame(l, 20);
          return { text: "คุณตะโกนจนเสียงแหบ คนครึ่งจัตุรัสหนีทัน — ตัวประกอบที่ไม่มีชื่อในนิยาย กลายเป็นวีรบุรุษของเมือง", kind: "milestone" };
        },
      },
      { label: "ไปเที่ยวตามปกติ (นิยายอาจผิดก็ได้)", run: (l) => { if (chance(l, 0.5)) { kill(l, "ตายในเทศกาลดอกไม้ตามบทที่ 3 ของนิยาย"); return bad("พลุดอกแรกขึ้น… ท้องฟ้าฉีกขาด"); } return bad("คุณรอดมาได้อย่างหวุดหวิด" + damage(l, 15, 35, "บาดเจ็บในเทศกาลดอกไม้")); } },
    ],
  },
];

// ───────────────────────── วัยเด็ก / สถาบัน ─────────────────────────

const YOUTH: GameEvent[] = [
  {
    id: "court.c.first_word",
    minAge: 1,
    maxAge: 2,
    weight: 20,
    prepare: (l) => ({ w: pick(l, ["แม่", "พ่อ", "เค้ก", "ม้าน้อย", "ไม่เอา"]) }),
    text: (_l, c) => `คำแรกที่คุณพูดคือ "${c.w}" พี่เลี้ยงรีบไปรายงานท่านดยุก… ไม่สิ ท่านพ่อ`,
    auto: (l) => { addStat(l, "happiness", 3); },
  },
  {
    id: "court.c.cold_father",
    minAge: 5,
    maxAge: 12,
    weight: (l) => (l.wealth === "elite" || l.wealth === "rich" ? 12 : 0),
    text: () => "ท่านพ่อไม่เคยมองหน้าคุณตรงๆ แม้แต่ครั้งเดียว ในนิยาย ความเย็นชานี้คือจุดเริ่มต้นที่ทำให้ตัวร้ายบิดเบี้ยว",
    choices: [
      { label: "เขียนจดหมายขอบคุณสอดไว้ใต้ประตูห้องทำงานทุกสัปดาห์", run: (l) => { const d = firstPerson(l, "father"); if (d) d.bond = clamp(d.bond + 25, 0, 100); return good("สามเดือนต่อมา ท่านพ่อเรียกคุณไปกินอาหารเย็นด้วยกันเป็นครั้งแรก"); } },
      { label: "ตั้งใจเรียนจนเป็นที่หนึ่ง", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => { const d = firstPerson(l, "father"); if (ok && d) { d.bond = clamp(d.bond + 15, 0, 100); return good("ท่านพ่อลูบหัวคุณ… มือหนักแต่อบอุ่น"); } return meh("ท่านพ่อพยักหน้าเฉยๆ แล้วกลับไปทำงานต่อ"); } },
      { label: "ไม่ต้องการความรักจากเขา", run: (l) => { addStat(l, "happiness", -6); return meh("คุณเรียนรู้ที่จะอยู่คนเดียวในคฤหาสน์ใหญ่"); } },
    ],
  },
  {
    id: "court.c.adopted",
    minAge: 6,
    maxAge: 12,
    weight: (l) => (l.wealth === "elite" || l.wealth === "rich" ? 6 : 0),
    title: "น้องบุญธรรม",
    prepare: (l) => { const p = createPerson(l, "sibling", { gender: "f", age: Math.max(1, l.age - 1), bond: 40, lastName: l.lastName }); return { id: p.id, name: shortName(p) }; },
    text: (_l, c) => `ท่านพ่อรับเด็กกำพร้าชื่อ${c.name}มาเป็นลูกบุญธรรม ทุกคนในบ้านเอ็นดูนางมากกว่าคุณ`,
    choices: [
      { label: "ดูแลนางอย่างดี", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = 80; addStat(l, "happiness", 4); return good(`${c.name}เรียกคุณว่าพี่ด้วยตาเป็นประกาย และไม่ยอมห่างคุณอีกเลย`); } },
      { label: "ระวังตัว นางอาจเป็นงูพิษ", check: { stat: "smarts", dc: 55 }, run: (l, c, ok) => { if (ok) { l.flags.sisterSchemer = true; return sys(`คุณเห็น${c.name}แอบทำแจกันแตกแล้วโทษคนรับใช้ — คุณรู้แล้วว่าต้องระวังใคร`); } return meh("คุณไม่พบอะไรผิดปกติ… หรือนางเก่งเกินไป"); } },
    ],
  },
  {
    id: "court.c.governess",
    minAge: 6,
    maxAge: 12,
    weight: (l) => (noble(l) ? 10 : 0),
    text: () => "ครูพี่เลี้ยงคนใหม่เข้มงวดสุดๆ วางหนังสือบนหัวคุณแล้วสั่งให้เดินตรงร้อยรอบ",
    choices: [
      { label: "อดทนฝึกตาม", run: (l) => { addStat(l, "looks", 3); addStat(l, "smarts", 2); return good("ท่วงท่าของคุณสง่างามจนแม่ยังทึ่ง"); } },
      { label: "แกล้งครูจนลาออก", run: (l) => { addStat(l, "happiness", 5); addFame(l, -2); return meh("ครูคนที่เจ็ดลาออกแล้ว ข่าวลือเรื่องเด็กเอาแต่ใจเริ่มแพร่"); } },
    ],
  },
  {
    id: "court.c.bakery",
    minAge: 6,
    maxAge: 13,
    weight: (l) => (l.wealth === "poor" ? 12 : 0),
    text: () => "ร้านขนมปังของครอบครัวขาดคนช่วย พ่อปลุกคุณตอนตีสี่ทุกวัน",
    choices: [
      { label: "ช่วยนวดแป้งเต็มที่", run: (l) => { addStat(l, "health", 3); addMoney(l, 3000); return good("แขนคุณแข็งแรงขึ้น และขนมปังของบ้านขายดีขึ้นด้วย"); } },
      { label: "เสนอสูตรขนมจากโลกเก่า", tone: "special", show: (l) => !!l.flags.role, run: (l) => { l.flags.recipe = true; addMoney(l, 15000); addFame(l, 3); return sys("ชีสเค้กสูตรที่คุณจำมาขายหมดทุกเช้า คิวยาวถึงหัวมุมถนน"); } },
    ],
  },
  {
    id: "court.c.illegitimate",
    minAge: 8,
    maxAge: 14,
    weight: (l) => (l.wealth === "poor" ? 2 : 0),
    title: "ความลับของชาติกำเนิด",
    text: () => "รถม้าตราอินทรีทองจอดหน้าบ้าน ชายวัยกลางคนในชุดหรูมองหน้าคุณนานมาก \"ดวงตาสีม่วงคู่นั้น… เป็นลูกของข้าจริงๆ\"",
    choices: [
      { label: "ยอมกลับไปกับเขา", run: (l) => { l.wealth = "rich"; l.flags.illegitimate = true; addMoney(l, 200_000); return { text: "คุณกลายเป็นลูกนอกสมรสของเคานต์ ชีวิตเปลี่ยนจากหน้ามือเป็นหลังมือ แต่สายตาคนในคฤหาสน์เย็นชาเหลือเกิน", kind: "milestone" }; } },
      { label: "ปฏิเสธ แม่ที่นี่คือแม่ของฉัน", run: (l) => { const m = firstPerson(l, "mother"); if (m) m.bond = 100; return good("แม่กอดคุณแน่นจนหายใจไม่ออก"); } },
    ],
  },
  {
    id: "court.academy",
    minAge: 13,
    maxAge: 13,
    forced: true,
    title: "สถาบันจักรวรรดิ",
    text: (l) => (noble(l) ? "ถึงวัยเข้าสถาบันจักรวรรดิ โรงเรียนของบุตรหลานขุนนางที่ทุกเรื่องราวในนิยายเกิดขึ้นที่นี่" : "สถาบันจักรวรรดิเปิดสอบทุนสำหรับสามัญชนเพียงสามที่นั่งต่อปี"),
    choices: [
      { label: "เข้าเรียน", show: noble, run: (l) => { l.flags.academy = true; return meh("ประตูเหล็กดัดสีทองเปิดออกต้อนรับคุณ"); } },
      { label: "สอบชิงทุน", show: (l) => !noble(l), check: { stat: "smarts", dc: 65 }, run: (l, _c, ok) => { if (ok) { l.flags.academy = true; l.flags.scholarship = true; addFame(l, 5); return good("คุณสอบได้ที่หนึ่ง! สามัญชนคนแรกในรอบสิบปีที่ได้ทุนเต็มจำนวน"); } return meh("คุณพลาดไปหนึ่งคะแนน ปีนี้ไม่มีทุนสำหรับคุณ"); } },
      { label: "ไม่เรียน ทำงานช่วยที่บ้าน", show: (l) => !noble(l), run: (l) => { addMoney(l, 5000); return meh("ชีวิตสามัญชนก็มีความสุขแบบของมัน"); } },
    ],
  },
  {
    id: "court.a.exam",
    minAge: 13,
    maxAge: 18,
    maxTimes: 2,
    weight: (l) => (l.flags.academy ? 10 : 0),
    text: () => "สอบปลายภาคของสถาบัน ผลจะติดประกาศให้ทั้งโรงเรียนเห็น",
    choices: [
      { label: "อ่านหนังสือทั้งคืน", check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => (ok ? (addFame(l, 4), addStat(l, "smarts", 2), good("ชื่อคุณอยู่บนสุดของประกาศ")) : meh("อันดับกลางๆ ไม่มีใครสนใจ")) },
      { label: "ใช้ความรู้จากโลกเก่า", tone: "special", show: (l) => !!l.flags.role, check: { stat: "smarts", dc: 45 }, run: (l, _c, ok) => (ok ? (addFame(l, 6), sys("คุณแก้โจทย์เลขด้วยแคลคูลัส อาจารย์ขอให้คุณไปสอนแทนหนึ่งคาบ")) : meh("โลกนี้ไม่ใช้สูตรเดียวกับโลกเก่า… คะแนนกลางๆ")) },
    ],
  },
  {
    id: "court.a.bully",
    minAge: 13,
    maxAge: 18,
    maxTimes: 2,
    weight: (l) => (l.flags.scholarship ? 14 : 0),
    prepare: (l) => ({ r: clamp(rank(l) + randInt(l, -1, 1), 0, 6) }),
    text: (l, c) => `กลุ่มคุณหนูขุนนางล้อมคุณในสวนกุหลาบ หัวหน้ากลุ่มพลังเวท${RL(l, Number(c.r))}โยนตำราของคุณลงบ่อน้ำ "สามัญชนกลิ่นเหม็นขนมปัง"`,
    choices: [
      { label: "ปล่อยพลังเวทให้เห็น", tone: "special", show: (l, c) => rank(l) > Number(c.r), run: (l) => { addFame(l, 8); addStat(l, "happiness", 10); return good("น้ำในบ่อลอยขึ้นมาทั้งบ่อ ตำราลอยกลับมาที่มือคุณแห้งสนิท ทุกคนวิ่งหนีกระเจิง"); } },
      { label: "ลงไปเก็บตำรา", run: (l) => { addStat(l, "health", -2); addStat(l, "happiness", -5); return meh("เสื้อเปียกโชก แต่ตำรายังอ่านได้"); } },
    ],
  },
  {
    id: "court.a.royal_attention",
    minAge: 14,
    maxAge: 19,
    maxTimes: 1,
    weight: (l) => (l.flags.academy && single(l) ? (isVillain(l) && broken(l) >= 1 ? 18 : 6) : 0),
    text: (l) => `${royal(l)}เริ่มมานั่งข้างคุณในห้องสมุดทุกบ่าย ${isVillain(l) ? "— แปลกเหลือเกิน ในนิยายพระองค์เกลียดคุณที่สุด" : ""}`,
    choices: [
      { label: "ชวนคุยเรื่องหนังสือที่พระองค์อ่าน", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { l.flags.royalInterest = true; return good("พระองค์ยิ้ม — รอยยิ้มที่ในนิยายมีไว้ให้ตัวเอกคนเดียว"); } return meh("บทสนทนาจบลงอย่างกระอักกระอ่วน"); } },
      { label: "ย้ายไปนั่งที่อื่น", run: () => meh("คุณไม่อยากเข้าใกล้ต้นตอของ Death Flag") },
    ],
  },
];

// ───────────────────────── ชีวิตในราชสำนัก ─────────────────────────

const ADULT: GameEvent[] = [
  {
    id: "court.royal_proposal",
    minAge: 18,
    maxAge: 30,
    maxTimes: 1,
    weight: (l) => (l.flags.royalInterest && single(l) && !l.flags.exiled ? 25 : 0),
    title: "ขอแต่งงาน",
    text: (l) => `${royal(l)}คุกเข่าลงกลางสวนกุหลาบของพระราชวัง ยื่นแหวนทับทิมประจำราชวงศ์ให้คุณ`,
    choices: [
      { label: "ตอบตกลง", run: (l) => { const p = createPerson(l, "spouse", { gender: l.gender === "f" ? "m" : "f", age: l.age + 1, bond: 85, job: "ราชวงศ์" }); p.name = royal(l); l.flags.royalSpouse = true; addFame(l, 30); addStat(l, "happiness", 20); return { text: "งานอภิเษกจัดใหญ่ที่สุดในรอบร้อยปี ระฆังทั้งนครหลวงดังพร้อมกัน", kind: "milestone" }; } },
      { label: "ปฏิเสธอย่างสุภาพ", run: (l) => { addFame(l, -5); return meh("พระองค์ยิ้มเศร้าๆ แล้วเก็บแหวนกลับ"); } },
    ],
  },
  {
    id: "court.coronation",
    minAge: 26,
    maxAge: 50,
    maxTimes: 1,
    weight: (l) => (l.flags.royalSpouse && people(l, "spouse").length ? 15 : 0),
    title: "พิธีราชาภิเษก",
    text: (l) => `จักรพรรดิองค์เก่าสละราชสมบัติ ${royal(l)}คู่ชีวิตของคุณขึ้นครองบัลลังก์ — และมงกุฎอีกองค์หนึ่งรอคุณอยู่`,
    auto: (l) => { l.flags.crowned = true; addFame(l, 40); addStat(l, "happiness", 15); addMoney(l, 50_000_000); return "milestone"; },
  },
  {
    id: "court.contract",
    minAge: 18,
    maxAge: 28,
    maxTimes: 1,
    weight: (l) => (single(l) && !l.flags.royalSpouse ? (l.flags.northInterest ? 25 : 6) : 0),
    title: "สัญญาแต่งงาน",
    text: (l) => `${north(l)}ผู้ขึ้นชื่อว่าเย็นชาที่สุดในจักรวรรดิ ยื่นเอกสารให้คุณ "สัญญาแต่งงานหนึ่งปี ข้าต้องการคู่สมรสเพื่อปิดปากราชสำนัก — ครบปีจะให้เงินชดเชยหนึ่งร้อยเหรียญทอง"`,
    choices: [
      { label: "เซ็นสัญญา", run: (l) => { const p = createPerson(l, "spouse", { gender: l.gender === "f" ? "m" : "f", age: l.age + 4, bond: 30, job: "ดยุก" }); p.name = north(l); l.flags.contract = l.age; return meh("คุณย้ายไปปราสาทหิมะทางเหนือ ห้องนอนแยก โต๊ะอาหารยาวสิบเมตร"); } },
      { label: "ปฏิเสธ", run: () => meh("อีกฝ่ายพยักหน้าแล้วจากไปโดยไม่พูดอะไรอีก") },
    ],
  },
  {
    id: "court.contract_end",
    minAge: 19,
    maxAge: 40,
    maxTimes: 1,
    weight: (l) => (l.flags.contract && l.age >= Number(l.flags.contract) + 1 && people(l, "spouse").length ? 40 : 0),
    title: "สัญญาครบกำหนด",
    text: (l) => `หนึ่งปีผ่านไป ${north(l)}วางถุงเหรียญทองบนโต๊ะ แต่มือที่วางนั้นสั่นเล็กน้อย "…เจ้าจะไปจริงๆ หรือ"`,
    choices: [
      { label: "ฉีกสัญญาทิ้ง แล้วอยู่ต่อ", run: (l) => { const p = people(l, "spouse")[0]; if (p) p.bond = 95; addStat(l, "happiness", 25); return { text: "ดยุกผู้เย็นชาที่สุดในจักรวรรดิ… ยิ้มเป็นครั้งแรก", kind: "milestone" }; } },
      { label: "รับเงินแล้วจากไป", run: (l) => { addMoney(l, 1_000_000); l.people = l.people.filter((x) => x.relation !== "spouse"); return meh(`คุณออกเดินทางพร้อม ${money(l, 1_000_000)} หิมะเริ่มตก… คุณไม่หันกลับไปมอง`); } },
    ],
  },
  {
    id: "court.tyrant",
    minAge: 16,
    maxAge: 60,
    maxTimes: 2,
    weight: (l) => (l.fame >= 15 ? 6 : 0),
    text: () => "จักรพรรดิทรราชผู้ฆ่าพี่น้องเพื่อชิงบัลลังก์ เรียกคุณเข้าเฝ้าเป็นการส่วนตัว พระเนตรสีแดงจ้องคุณไม่กะพริบ \"ทำให้ข้าสนุก แล้วเจ้าจะได้อยู่\"",
    choices: [
      { label: "เล่าเรื่องจากโลกเก่าให้ฟัง", tone: "special", show: (l) => !!l.flags.role, run: (l) => { addFame(l, 10); addMoney(l, 500_000); return sys("คุณเล่าเรื่องซินเดอเรลล่าเวอร์ชันแก้แค้น จักรพรรดิหัวเราะจนน้ำตาไหล แล้วพระราชทานรางวัลก้อนโต"); } },
      { label: "ตอบอย่างกล้าหาญ ไม่ประจบ", check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => (ok ? (addFame(l, 12), good("\"น่าสนใจ… คนแรกที่ไม่สั่นต่อหน้าข้า\" พระองค์แต่งตั้งคุณเป็นที่ปรึกษาส่วนพระองค์")) : bad("พระองค์เบื่อหน่ายแล้วโบกมือไล่… คุณรอดมาได้ แต่ขาสั่นไปทั้งวัน")) },
      { label: "ประจบสอพลอ", run: (l) => { addFame(l, -4); return meh("พระองค์หาวใส่หน้าคุณ"); } },
    ],
  },
  {
    id: "court.recipe_business",
    minAge: 16,
    maxAge: 45,
    maxTimes: 1,
    weight: (l) => (l.flags.role ? 6 : 0),
    title: "ความรู้จากโลกเก่า",
    text: () => "คุณนึกขึ้นได้ว่าโลกนี้ยังไม่มีมายองเนส ชีสเค้ก หรือแม้แต่ชุดชั้นในแบบมีโครง…",
    choices: [
      { label: "เปิดร้านขนมหวาน", run: (l) => { l.job = { careerId: "patisserie", level: 2, performance: 60, years: 0 }; addFame(l, 6); return { text: "ร้านขนมของคุณกลายเป็นที่ที่คุณหนูทั้งนครหลวงต้องมาต่อคิว", kind: "milestone" }; } },
      { label: "ขายสูตรให้พ่อค้า", run: (l) => { addMoney(l, 2_000_000); return good(`พ่อค้ายื่นเงินให้ ${money(l, 2_000_000)} โดยไม่ต่อรองแม้แต่คำเดียว`); } },
      { label: "ออกแบบชุดราตรีแบบใหม่", run: (l) => { addFame(l, 15); return good("ชุดเปิดไหล่ของคุณกลายเป็นเทรนด์ทั้งงานเต้นรำ"); } },
    ],
  },
  {
    id: "court.poison",
    minAge: 16,
    maxAge: 80,
    maxTimes: 2,
    weight: 4,
    text: () => "ไวน์ในแก้วของคุณมีฟองเล็กๆ ผิดปกติ… ในนิยาย นี่คือยาพิษดอกไม้ดำ",
    choices: [
      { label: "แกล้งทำแก้วหกใส่ชุดคนข้างๆ", run: (l) => { addFame(l, -2); return good("คุณรอดพ้นยาพิษ แต่ต้องจ่ายค่าชุดใหม่ให้มาร์ควิสเนส"); } },
      { label: "ใช้เวทตรวจพิษ", show: (l) => !!l.power, run: (l) => { addFame(l, 5); return good("คุณประกาศกลางงานว่าไวน์มีพิษ คนรับใช้ที่วางยาถูกจับได้คาที่"); } },
      { label: "ดื่ม (อาจคิดมากไปเอง)", check: { stat: "luck", dc: 55 }, run: (l, _c, ok) => (ok ? meh("…ก็แค่ไวน์ฟองฟู่ธรรมดา") : bad("ลำคอแสบร้อนเหมือนไฟลุก" + damage(l, 25, 45, "ถูกวางยาพิษดอกไม้ดำในงานเลี้ยง"))) },
    ],
  },
  {
    id: "court.monster_wave",
    minAge: 17,
    maxAge: 55,
    maxTimes: 2,
    weight: (l) => (l.power ? 5 : 0),
    title: "คลื่นมอนสเตอร์",
    text: () => "หอสัญญาณทางเหนือจุดไฟแดงพร้อมกันทั้งเจ็ดหอ — คลื่นมอนสเตอร์ครั้งใหญ่ในรอบห้าสิบปีกำลังมุ่งหน้าลงใต้",
    choices: [
      {
        label: "อาสาไปแนวหน้า",
        tone: "danger",
        odds: (l) => fightOdds(l, 4),
        survival: (l) => survivalOdds(l, 4, 0.1),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 20); gainExp(l, 1000); return { text: "คุณยืนเฝ้ากำแพงเมืองสามวันสามคืน คลื่นมอนสเตอร์ถูกตีถอย ชื่อคุณถูกขับขานในบทเพลงของกวี", kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, 4, 0.1))) { kill(l, "เสียชีวิตขณะต้านคลื่นมอนสเตอร์ที่ชายแดนเหนือ"); return bad("หิมะสีแดงกลบร่างคุณ…"); }
          return bad("แนวรบแตก คุณถูกหามกลับมาทางใต้" + damage(l, 15, 30, "บาดแผลจากคลื่นมอนสเตอร์"));
        },
      },
      { label: "ช่วยรักษาผู้บาดเจ็บที่แนวหลัง", run: (l) => { addFame(l, 6); gainExp(l, 300); return good("มือคุณเปื้อนเลือดคนอื่นทั้งสัปดาห์ แต่ไม่มีใครในเต็นท์ของคุณตายเลย"); } },
    ],
  },
  {
    id: "court.witch_hunt",
    minAge: 14,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => (l.power?.hunterClass === "c_dark" || guildById(l.power?.guild)?.demonic ? 12 : 0),
    title: "ล่าแม่มด",
    text: () => "อัศวินวิหารบุกเข้ามากลางดึก \"เราได้รับรายงานว่ามีผู้ใช้เวทมืดอยู่ในบ้านนี้\"",
    choices: [
      { label: "ซ่อนพลังเวท", check: { stat: "smarts", dc: 60 }, run: (l, _c, ok) => (ok ? meh("พวกเขาค้นทั้งบ้านแต่ไม่พบอะไร") : bad("เงาของคุณขยับเองต่อหน้าอัศวิน!" + damage(l, 15, 30, "ถูกวิหารเผาทั้งเป็นข้อหาใช้เวทมืด"))) },
      { label: "สู้ฝ่าออกไป", tone: "danger", odds: (l) => fightOdds(l, rank(l)), survival: (l) => survivalOdds(l, rank(l)), run: (l, _c, ok) => { if (ok) { addFame(l, -10); gainExp(l, 400); return meh("คุณหนีออกมาได้ แต่ชื่อคุณขึ้นบัญชีดำของวิหารแล้ว"); } if (!chance(l, survivalOdds(l, rank(l)))) { kill(l, "ถูกวิหารเผาทั้งเป็นข้อหาใช้เวทมืด"); return bad("กองไฟกลางจัตุรัสลุกโชน…"); } return bad("คุณหนีรอดมาอย่างสะบักสะบอม" + damage(l, 15, 25, "ถูกอัศวินวิหารทำร้าย")); } },
    ],
  },
  {
    id: "court.scandal",
    minAge: 16,
    maxAge: 50,
    maxTimes: 2,
    weight: (l) => (noble(l) ? 5 : 0),
    text: () => "ข่าวลือแพร่ไปทั่วสังคมชั้นสูงว่าคุณแอบพบกับอัศวินองครักษ์ยามวิกาล หนังสือพิมพ์ซุบซิบลงหน้าหนึ่ง",
    choices: [
      { label: "จัดงานน้ำชาแล้วเผชิญหน้ากับคนปล่อยข่าว", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => (ok ? (addFame(l, 8), good("คุณหักหน้าเคานต์เตสปากมากกลางงาน จนเธอต้องขอโทษต่อหน้าทุกคน")) : (addFame(l, -8), bad("งานน้ำชากลายเป็นสนามรบ ข่าวลือยิ่งแรงขึ้น"))) },
      { label: "เงียบไว้ ข่าวลือเดี๋ยวก็หายไป", run: (l) => { addFame(l, -3); return meh("สองเดือนต่อมามีข่าวลือใหม่มาแทน"); } },
    ],
  },
  {
    id: "court.heir",
    minAge: 24,
    maxAge: 40,
    maxTimes: 1,
    weight: (l) => (people(l, "spouse").length && !people(l, "child", false).length && noble(l) ? 8 : 0),
    text: () => "แม่สามีมาเยี่ยมพร้อมยาบำรุงเจ็ดขวด \"ตระกูลเรารอทายาทมาห้าปีแล้วนะ\"",
    choices: [
      { label: "ยิ้มรับแล้วเททิ้งทีหลัง", run: (l) => { addStat(l, "happiness", 2); return meh("ไม้ประดับในห้องโตเร็วผิดปกติ"); } },
      { label: "บอกว่าทายาทไม่ใช่เครื่องจักรผลิตลูก", check: { stat: "smarts", dc: 55 }, run: (_l, _c, ok) => (ok ? good("แม่สามีเงียบไปนาน แล้วพูดว่า \"…เจ้าพูดถูก\"") : bad("สงครามเย็นในคฤหาสน์เริ่มขึ้น")) },
    ],
  },
  {
    id: "court.maid_life",
    minAge: 13,
    maxAge: 22,
    maxTimes: 1,
    weight: (l) => (l.wealth === "poor" && !l.flags.academy ? 10 : 0),
    text: () => "คุณได้งานเป็นคนรับใช้ในคฤหาสน์ดยุก วันหนึ่งทายาทของบ้านเดินชนคุณจนถาดชาตกแตก",
    choices: [
      { label: "ขอโทษแล้วเก็บกวาด", run: (l) => { if (chance(l, 0.4) && single(l)) { const p = createPerson(l, "partner", { gender: l.gender === "f" ? "m" : "f", age: l.age + 2, bond: 55, job: "ทายาทดยุก" }); return good(`${shortName(p)}ช่วยคุณเก็บเศษถ้วยแล้วยิ้มให้… ความสัมพันธ์ต้องห้ามเริ่มขึ้น`); } return meh("หัวหน้าคนรับใช้หักเงินเดือนคุณค่าถ้วยชา"); } },
      { label: "ต่อว่ากลับ", run: (l) => { addFame(l, 2); return meh("ทายาทดยุกมองคุณอย่างสนใจ \"ไม่เคยมีใครกล้าว่าข้าเลย\""); } },
    ],
  },
];

// ───────────────────────── ความทรงจำ ─────────────────────────

const F = worldFacts;
const pct = (l: Life) => `${Math.round(memoryOdds(l) * 100)}%`;

function familyLoss(l: Life, p: number): string {
  const lost: string[] = [];
  for (const x of l.people) {
    if (!x.alive || !["father", "mother", "sibling", "spouse", "child"].includes(x.relation)) continue;
    if (chance(l, p)) { x.alive = false; lost.push(shortName(x)); }
  }
  if (lost.length) addStat(l, "happiness", -15 * lost.length);
  return lost.join(", ");
}

const MEMORY: GameEvent[] = [
  {
    id: "court.memory.death_warning",
    minAge: 0,
    maxAge: 200,
    forced: true,
    when: (l) => { const m = remembers(l, "death"); return !!m && m.age - 1 === l.age; },
    system: true,
    text: (l) => `[ความทรงจำ] ปีหน้าคือปีที่คุณตายในชาติก่อน — "${remembers(l, "death")!.text}"`,
  },
  {
    id: "court.world.rebellion",
    minAge: 10,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).cataclysmAge,
    title: "กบฏแย่งชิงบัลลังก์",
    text: (l) => (l.flags.coupFoiled ? "คืนที่กบฏควรจะบุกวัง ทหารองครักษ์ที่คุณเตือนไว้ล่วงหน้าจับกุมแกนนำได้ทั้งหมดก่อนรุ่งสาง" : "คืนเดือนดับ กองทัพของแกรนด์ดยุกผู้เป็นอาของจักรพรรดิบุกวัง ขุนนางที่ภักดีต่อราชวงศ์ถูกกวาดล้างทั้งตระกูล"),
    choices: [
      { label: "ราชวงศ์ปลอดภัย", show: (l) => !!l.flags.coupFoiled, run: (l) => { observe(l, "rebellion", "กบฏของแกรนด์ดยุกบุกวัง"); l.flags.savedFamily = true; addFame(l, 30); return { text: "จักรพรรดิพระราชทานตำแหน่งให้ตระกูลของคุณในฐานะผู้กอบกู้บัลลังก์", kind: "milestone" }; } },
      { label: "ช่วยองค์ชายน้อยหนีจากวัง", tone: "danger", show: (l) => !l.flags.coupFoiled, survival: (l) => clamp(0.55 + (l.power ? 0.2 : 0) + (l.stats.luck - 50) / 150, 0.2, 0.95), odds: (l) => clamp(0.55 + (l.power ? 0.2 : 0) + (l.stats.luck - 50) / 150, 0.2, 0.95), run: (l, _c, ok) => { const lost = noble(l) ? familyLoss(l, 0.3) : ""; observe(l, "rebellion", lost ? `กบฏของแกรนด์ดยุกกวาดล้างขุนนาง และคุณเสีย${lost}ไป` : "กบฏของแกรนด์ดยุกบุกวังกลางดึก"); if (!ok) { kill(l, "ถูกทหารกบฏสังหารขณะพาองค์ชายหนี"); return bad("ลูกธนูดอกสุดท้ายหาคุณเจอในอุโมงค์ลับ"); } addFame(l, 35); return { text: `คุณพาองค์ชายน้อยหนีไปถึงชายแดนได้ — สิบปีต่อมาพระองค์จะกลับมาทวงบัลลังก์${lost ? ` (แต่${lost}ไม่รอด)` : ""}`, kind: "milestone" }; } },
      { label: "หลบซ่อนรอจนพายุผ่านไป", show: (l) => !l.flags.coupFoiled, run: (l) => { const lost = noble(l) ? familyLoss(l, 0.4) : ""; observe(l, "rebellion", lost ? `กบฏของแกรนด์ดยุกกวาดล้างขุนนาง และคุณเสีย${lost}ไป` : "กบฏของแกรนด์ดยุกบุกวังกลางดึก"); return lost ? bad(`คุณรอดมาได้ แต่${lost}ไม่รอด`) : meh("คุณรอดมาได้ แต่เมืองหลวงไม่เหมือนเดิมอีกต่อไป"); } },
    ],
  },
  {
    id: "court.memory.rebellion_prep",
    minAge: 9,
    maxAge: 200,
    forced: true,
    when: (l) => !!remembers(l, "rebellion") && l.age === F(l).cataclysmAge - 1,
    title: "ความทรงจำ: คืนเดือนดับ",
    text: (l) => `ปีหน้า — ${remembers(l, "rebellion")!.text} คุณรู้ชื่อแกนนำทุกคน`,
    choices: [
      { label: (l) => `ส่งจดหมายลับถึงหน่วยองครักษ์ (อนาคตยังตรง ${pct(l)})`, tone: "special", run: (l) => { if (useMemory(l)) { l.flags.coupFoiled = true; return good("องครักษ์เริ่มสืบสวนอย่างเงียบๆ ตามรายชื่อที่คุณให้"); } return bad("แกนนำกบฏเปลี่ยนแผน… อนาคตเบี่ยงไปแล้ว"); } },
      { label: "พาครอบครัวออกจากเมืองหลวง", run: (l) => { for (const p of l.people) if (["father", "mother", "sibling"].includes(p.relation)) p.bond = clamp(p.bond + 5, 0, 100); l.flags.coupFoiled = false; return meh("คุณเลือกปกป้องคนของตัวเองก่อน"); } },
    ],
  },
  {
    id: "court.world.plague_news",
    minAge: 10,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).lotteryAge && !remembers(l, "plague"),
    text: () => "โรคระบาดดอกไม้ดำลามทั่วนครหลวง ยารักษาเดียวคือ 'หญ้าจันทร์เงิน' ซึ่งราคาพุ่งขึ้นร้อยเท่าในหนึ่งสัปดาห์",
    auto: (l) => { observe(l, "plague", `อายุ ${l.age}: โรคระบาดดอกไม้ดำ — หญ้าจันทร์เงินราคาพุ่งร้อยเท่า`); addStat(l, "health", -8); return "bad"; },
  },
  {
    id: "court.memory.plague",
    minAge: 10,
    maxAge: 200,
    forced: true,
    when: (l) => !!remembers(l, "plague") && l.age === F(l).lotteryAge - 1,
    title: "ความทรงจำ: โรคระบาดดอกไม้ดำ",
    text: () => "ปีหน้าโรคระบาดดอกไม้ดำจะมาถึง และหญ้าจันทร์เงินจะราคาพุ่งร้อยเท่า… ตอนนี้มันยังเป็นแค่วัชพืชข้างทาง",
    choices: [
      { label: (l) => `กว้านซื้อหญ้าจันทร์เงินทั้งตลาด (อนาคตยังตรง ${pct(l)})`, tone: "special", run: (l) => { const cost = Math.min(Math.max(0, l.money), 500_000); addMoney(l, -cost); if (useMemory(l)) { addMoney(l, cost * 20 + 2_000_000); addFame(l, 15); l.flags.savedFamily = true; return { text: "เมื่อโรคระบาดมาถึง คุณแจกยาให้คนจนและขายให้ขุนนาง — ทั้งร่ำรวยและเป็นที่รักของประชาชน", kind: "milestone" }; } return bad("โรคระบาดไม่มา… หญ้าเต็มโกดังเน่าเสีย อนาคตเปลี่ยนไปแล้ว"); } },
      { label: "เตรียมยาไว้ให้ครอบครัวพอ", run: (l) => { l.flags.savedFamily = true; return good("คุณเก็บยาไว้พอสำหรับทุกคนในบ้าน"); } },
    ],
  },
];

// ───────────────────────── มรดก ─────────────────────────

const LEGACY: GameEvent[] = [
  {
    id: "court.legacy.portrait",
    minAge: 8,
    maxAge: 80,
    weight: (l) => (l.legacy ? 10 : 0),
    text: (l) => `ในหอภาพของพระราชวัง มีภาพวาดสีน้ำมันขนาดใหญ่ของ${l.legacy!.founderName} — ใบหน้าที่คุณเคยเห็นในกระจกทุกเช้าในชาติก่อน`,
    choices: [
      { label: "ยืนมองนานๆ", run: (l) => { addStat(l, "happiness", 5); return sys("ภัณฑารักษ์บอกว่าคุณหน้าคล้ายคนในภาพอย่างน่าประหลาด"); } },
      { label: "บอกภัณฑารักษ์ว่าคิ้วในภาพผิด", run: (l) => { addFame(l, 1); return meh("ภัณฑารักษ์มองคุณอย่างงุนงง"); } },
    ],
  },
  {
    id: "court.legacy.descendant",
    minAge: 16,
    maxAge: 70,
    weight: (l) => (l.legacy && !l.flags.descendant ? 12 : 0),
    prepare: (l) => { const p = createPerson(l, "friend", { age: l.age + randInt(l, -3, 3), bond: 35, lastName: l.legacy!.lastName }); return { id: p.id, name: shortName(p) }; },
    text: (l, c) => `${c.name}ทายาทตระกูล${l.legacy!.lastName}ที่ตกต่ำ กำลังถูกบังคับขายคฤหาสน์เก่าแก่ของตระกูล`,
    choices: [
      { label: "ช่วยไถ่ถอนคฤหาสน์", tone: "special", show: (l) => l.money >= 1_000_000, run: (l, c) => { addMoney(l, -1_000_000); const p = l.people.find((x) => x.id === c.id); if (p) p.bond = 90; return good("คุณยืนอยู่ในห้องโถงที่เคยเป็นของคุณเมื่อหลายสิบปีก่อน ทุกอย่างยังเหมือนเดิม"); } },
      { label: "ปล่อยไป", run: (l) => { addStat(l, "happiness", -6); return meh("ตระกูลที่คุณสร้างไว้… กำลังจะหายไป"); } },
    ],
  },
];

export const COURT_EVENTS: GameEvent[] = [AWAKEN_MEMORY, ASSESSMENT, ...VILLAIN, ...OTHER_ROLES, ...YOUTH, ...ADULT, ...MEMORY, ...LEGACY];
