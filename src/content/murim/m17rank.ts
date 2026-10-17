// M17 — ทำเนียบยอดฝีมือ: ท้าประลอง ไต่อันดับ ถูกท้า ตกอันดับ และชีวิตของยอดฝีมือสิบคน
import type { Ctx, GameEvent } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../engine/util";
import { gainExp } from "../hunter/power";
import {
  EPITHETS, type Master, addFavor, givePill, addGrudge, alignment, bad, big, challengeTarget, dropPlace, good, hurt, masterAt, masterLabel,
  masterOdds, masterSurvival, masters, mayDie, meh, myPlace, npcName, openEntries, settle, rankOf, removeMaster, shiftAlign, sys, takePlace, wasRanked,
} from "./m17core";

const hasPower = (l: Life) => !!l.power;
const ranked = (l: Life) => myPlace(l) > 0;

/** ยอดฝีมือใน ctx (ถ้ายังอยู่ในทำเนียบ ใช้ค่าปัจจุบัน) */
function tgt(l: Life, c: Ctx): Master {
  return masters(l).find((m) => m.id === c.id) ?? { id: String(c.id), n: String(c.n), e: String(c.e), a: Number(c.a), cp: Number(c.cp) };
}
const ctxOf = (m: Master, extra: Ctx = {}): Ctx => ({ id: m.id, n: m.n, e: m.e, a: m.a, cp: m.cp, label: masterLabel(m), ...extra });
const placeText = (p: number) => (p ? `อันดับ ${p} แห่งทำเนียบยอดฝีมือ` : "นอกทำเนียบ");

/** ชนะยอดฝีมือ: ขึ้นไปแทนที่ */
function winAgainst(l: Life, c: Ctx): string {
  const p = takePlace(l, String(c.id));
  addFame(l, p <= 3 ? 12 : 6);
  gainExp(l, 200);
  return ` — ชื่อของคุณถูกจารึกเป็น${placeText(p)}`;
}


export const M17_RANK: GameEvent[] = [
  {
    id: "m17.r.announce",
    minAge: 8,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: (l) => !!l.flags.m17News || (hasPower(l) && rankOf(l) >= 3 && l.age % 4 === 0),
    text: (l) => {
      const list = masters(l);
      const top = list.slice(0, 3).map((m, i) => `${i + 1}. ${m.me ? "คุณเอง" : masterLabel(m)}`).join(" · ");
      const news = String(l.flags.m17News ?? "").split("|").filter(Boolean);
      const me = myPlace(l);
      return `📜 หอบันทึกยุทธภพประกาศทำเนียบยอดฝีมือประจำปี — ${top}${news.length ? ` | ข่าวใหญ่: ${news.join(" · ")}` : ""}${me ? ` | คุณอยู่${placeText(me)}` : ""}`;
    },
    auto: (l) => {
      delete l.flags.m17News;
      return "system";
    },
  },

  // ───── วัยเด็ก: ทำเนียบเป็นแค่ตำนาน ─────
  {
    id: "m17.r.first_glimpse",
    minAge: 6,
    maxAge: 13,
    weight: 8,
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 1, 5)) ?? masters(l)[0]),
    title: "ยอดฝีมือผ่านหมู่บ้าน",
    text: (_l, c) => `ชายสวมงอบนั่งดื่มชาอยู่หน้าร้านป้าหลิว ผู้ใหญ่ทั้งหมู่บ้านกระซิบกันว่านั่นคือ ${c.label} — หนึ่งในสิบยอดฝีมือแห่งใต้หล้า`,
    choices: [
      { label: "ยกชาร้อนไปเติมให้เขาเอง", run: (l, c) => { l.flags.m17Idol = String(c.label); addStat(l, "happiness", 8); return good(`${c.n}ลูบหัวคุณ "มือนิ่งดีนี่ เจ้าหนู" — คุณไม่ล้างมือไปสามวัน`); } },
      { label: "แอบตามไปดูเขาฝึกกระบี่ที่ริมลำธาร", check: { stat: "luck", dc: 50 }, skill: ["stealth"], run: (l, c, ok) => { if (ok) { l.flags.m17Idol = String(c.label); addStat(l, "smarts", 3); return good("คุณเห็นใบไม้ทั้งต้นร่วงลงพร้อมกันโดยไม่มีลมพัด ภาพนั้นติดตาไปทั้งชีวิต"); } return meh(`${c.n}หันมาตอนคุณเหยียบกิ่งไม้ดังกร๊อบ "กลับบ้านไปกินข้าวซะ" — แค่สายตาเดียวก็ทำขาคุณอ่อน`); } },
      { label: "ปาลูกหินใส่งอบ จะดูว่าเก่งจริงไหม", run: (l, c) => { addStat(l, "happiness", 4); l.flags.m17Stone = String(c.n); return meh("ลูกหินหยุดลอยกลางอากาศห่างงอบหนึ่งคืบ แล้วตกลงพื้นเฉยๆ เขาไม่แม้แต่จะหันมา แต่แม่หักไม้เรียวบนก้นคุณเสียเอง"); } },
    ],
  },
  {
    id: "m17.r.storyteller",
    minAge: 7,
    maxAge: 16,
    weight: 7,
    text: (l) => {
      const m = masterAt(l, 1);
      return `นักเล่านิทานที่ตลาดตีกรับเล่าเรื่อง ${m ? masterLabel(m) : "อันดับหนึ่งใต้หล้า"} ที่ปราบมารเก้าศพในคืนเดียว เด็กทั้งตลาดเถียงกันว่าใครในทำเนียบเก่งที่สุด`;
    },
    choices: [
      { label: "\"สักวันข้าจะอยู่ในทำเนียบนั่น!\"", run: (l) => { l.flags.m17Dream = true; addStat(l, "happiness", 4); return meh("เด็กทั้งตลาดหัวเราะ นักเล่านิทานหัวเราะดังที่สุด แต่เขาโยนถั่วต้มให้คุณหนึ่งกำ"); } },
      { label: "ถามว่ามีคนชั่วอยู่ในทำเนียบไหม", run: (l) => { addStat(l, "smarts", 2); return meh("นักเล่านิทานชะงัก แล้วหรี่ตา \"ทำเนียบวัดฝีมือ ไม่ได้วัดหัวใจ — ไอ้หนู เจ้าถามคำถามที่ผู้ใหญ่ไม่กล้าถาม\""); } },
    ],
  },

  // ───── ท้าประลองไต่อันดับ ─────
  {
    id: "m17.r.challenge",
    minAge: 16,
    maxAge: 90,
    maxTimes: 0,
    weight: (l) => (hasPower(l) && rankOf(l) >= 4 && challengeTarget(l) && Number(l.flags.m17LastChallenge ?? -9) < l.age - 1 ? 9 : 0),
    prepare: (l) => ctxOf(challengeTarget(l)!, { place: masters(l).findIndex((m) => m.id === challengeTarget(l)!.id) + 1 }),
    title: "ท้าประลองทำเนียบ",
    text: (l, c) => {
      const me = myPlace(l);
      return `${me ? `คุณยืนอยู่${placeText(me)}` : "ชื่อของคุณยังไม่อยู่ในทำเนียบ"} — ขั้นถัดไปคือ ${c.label} อายุ ${c.a} ปี อันดับ ${c.place} ผู้ที่ชนะเขาจะได้ชื่อนั้นไปแทน`;
    },
    choices: [
      {
        label: "ส่งสาส์นท้าประลองอย่างเปิดเผย บนยอดเขาหัวซาน",
        tone: "danger",
        odds: (l, c) => masterOdds(l, tgt(l, c)),
        survival: (l, c) => masterSurvival(l, tgt(l, c), 0.1),
        run: (l, c, ok) => {
          l.flags.m17LastChallenge = l.age;
          if (ok) return big(`กระบวนท่าสุดท้ายของคุณหยุดห่างคอ${c.n}เพียงเส้นผม ${c.n}วางอาวุธลงช้าๆ${winAgainst(l, c)}${Number(c.place) <= 3 ? givePill(l, 6) : ""}`);
          if (!chance(l, masterSurvival(l, tgt(l, c), 0.1))) { kill(l, `พ่ายแพ้ต่อ${c.label}บนยอดเขาหัวซาน`); return bad(`${c.n}ไม่ยั้งมือ — ในโลกของสิบยอดฝีมือ การประลองไม่ใช่เกม`); }
          const to = myPlace(l) ? dropPlace(l, 1) : 0;
          gainExp(l, 120);
          return bad(`คุณพ่ายแพ้ต่อหน้าคนดูนับพัน${to ? ` และตกไปอยู่อันดับ ${to}` : ""}` + hurt(l, 12, 28, `บาดเจ็บสาหัสจากการท้า${c.label}`));
        },
      },
      {
        label: "ขอประลองแบบ 'แตะแล้วหยุด' ไม่เอาชีวิตกัน",
        odds: (l, c) => masterOdds(l, tgt(l, c), -0.08),
        run: (l, c, ok) => {
          l.flags.m17LastChallenge = l.age;
          if (ok) { shiftAlign(l, 2); return big(`คุณแตะปลายกระบี่ที่ไหล่${c.n}ก่อนหนึ่งจังหวะ เขาหัวเราะลั่นแล้วคารวะ${winAgainst(l, c)}`); }
          const to = myPlace(l) ? dropPlace(l, 1) : 0;
          return meh(`${c.n}แตะจุดชีพจรที่ข้อมือคุณก่อน "อีกสามปีค่อยมาใหม่"${to ? ` — คุณตกไปอยู่อันดับ ${to}` : ""}`);
        },
      },
      {
        label: "ลอบวางยาในชาของเขาก่อนวันประลอง",
        tone: "danger",
        skill: ["stealth", "medical"],
        odds: (l, c) => clamp(masterOdds(l, tgt(l, c)) + 0.25, 0.05, 0.95),
        run: (l, c, ok) => {
          l.flags.m17LastChallenge = l.age;
          const a = shiftAlign(l, -15);
          if (ok) return big(`${c.n}กระอักเลือดกลางเวที ทุกคนคิดว่าเป็นธาตุไฟเข้าแทรก${winAgainst(l, c)} — มีแค่ศิษย์ของเขาที่จ้องคุณไม่วางตา${a}${addGrudge(l, `ศิษย์ของ${c.n}`, `วางยา${c.n}ก่อนประลองทำเนียบ`)}`);
          addFame(l, -15);
          if (myPlace(l)) dropPlace(l, 2);
          return bad(`${c.n}ดมชาแล้ววางลง "ยาเซียงหลิงผสมดอกท้อ… ฝีมือเท่านี้ยังกล้าใช้ยา?" เรื่องนี้รู้กันทั้งยุทธภพในสามวัน${a}`);
        },
      },
      { label: "ยังก่อน — ขอฝึกอีกปี", run: (l) => { gainExp(l, 60); return meh("คุณเผาสาส์นท้าประลองที่เขียนไว้ทิ้ง ปีหน้าค่อยว่ากัน"); } },
    ],
  },
  {
    id: "m17.r.challenged",
    minAge: 18,
    maxAge: 100,
    maxTimes: 0,
    weight: (l) => (ranked(l) ? 6 : 0),
    prepare: (l) => {
      const list = masters(l);
      const me = list.findIndex((m) => m.me);
      const below = list[me + 1];
      // อันดับสิบ: ผู้ท้าชิงมาจากนอกทำเนียบ
      return ctxOf(below ?? { id: "outsider", n: npcName(l), e: pick(l, EPITHETS), a: randInt(l, 22, 40), cp: list[me].cp - randInt(l, 0, 12) });
    },
    title: "สาส์นท้าประลอง",
    text: (l, c) => `ลูกดอกพร้อมสาส์นปักลงบนเสาบ้านคุณ — ${c.label} อันดับรองจากคุณ ขอท้าชิง${placeText(myPlace(l))} ภายในเดือนนี้`,
    choices: [
      {
        label: "รับคำท้า",
        tone: "danger",
        odds: (l, c) => masterOdds(l, tgt(l, c), 0.05),
        survival: (l, c) => masterSurvival(l, tgt(l, c), 0.15),
        run: (l, c, ok) => {
          if (ok) { addFame(l, 5); gainExp(l, 150); return good(`คุณปัดกระบวนท่าทั้งสิบสองของ${c.n}ออกไปได้หมด ${c.n}คุกเข่าคารวะ "ข้ายังไม่ถึง" — คุณรักษา${placeText(myPlace(l))}ไว้ได้`); }
          if (!chance(l, masterSurvival(l, tgt(l, c), 0.15))) { kill(l, `ถูก${c.label}ช่วงชิงอันดับ`); return bad("ฝ่ามือสุดท้ายนั้นหนักเกินกว่าที่คุณจะรับไหว…"); }
          const to = dropPlace(l, 1);
          return bad(`${c.n}ชนะ — ${to ? `คุณตกไปอยู่อันดับ ${to}` : "คุณหลุดจากทำเนียบ"}` + hurt(l, 8, 20, "บาดเจ็บจากการป้องกันอันดับ"));
        },
      },
      { label: "เมินเฉย — ทำเนียบไม่ใช่ทุกอย่างในชีวิต", run: (l) => { const to = dropPlace(l, 1); addFame(l, -5); addStat(l, "happiness", 3); return meh(`ข่าวลือว่าคุณ 'หนี' แพร่ไปทั่ว หอบันทึกยุทธภพลดชื่อคุณลง${to ? `เป็นอันดับ ${to}` : "จนหลุดทำเนียบ"} แต่คืนนั้นคุณหลับสบาย`); } },
      { label: "เชิญเขามาดื่มสุรา แล้วประลองกันด้วยหมากรุก", check: { stat: "smarts", dc: 60 }, skill: ["game", "social"], run: (l, c, ok) => { if (ok) { addFame(l, 3); return good(`คุณรุกฆาต${c.n}ในเจ็ดสิบสามตา เขาหัวเราะจนสุรากระเด็น "คนที่คิดได้ลึกขนาดนี้ ข้าไม่อยากเจอบนลานประลอง" แล้วถอนคำท้า${addFavor(l, c.n as string, "ไม่ถือโทษที่มาท้า แถมเลี้ยงสุรา")}`); } const to = dropPlace(l, 1); return meh(`${c.n}ชนะหมากรุก แล้วยืนกรานว่านี่ก็นับเป็นการประลอง หอบันทึกยุทธภพ…เห็นด้วย${to ? ` (อันดับ ${to})` : " (หลุดทำเนียบ)"}`); } },
    ],
  },
  {
    id: "m17.r.prodigy",
    minAge: 30,
    maxAge: 100,
    maxTimes: 2,
    weight: (l) => (ranked(l) || rankOf(l) >= 5 ? 4 : 0),
    prepare: (l) => ({ kid: pick(l, ["เด็กหนุ่ม", "เด็กสาว"]), n: `${pick(l, ["เสี่ยว", "อา"])}${pick(l, ["หลง", "เฟิง", "อิง", "เหม่ย", "ซาน"])}` }),
    title: "อัจฉริยะอายุสิบเจ็ด",
    text: (_l, c) => `${c.kid}อายุสิบเจ็ดชื่อ${c.n}เดินฝ่าฝนมาหน้าประตูบ้านคุณ "ข้ามาเพื่อเอาชื่อท่านไปใช้" — แววตานั่น คุณเคยเห็นในกระจกเมื่อนานมาแล้ว`,
    choices: [
      {
        label: "สอนบทเรียนให้รู้ว่าฟ้านั้นสูงแค่ไหน",
        odds: (l) => clamp(0.55 + rankOf(l) * 0.05, 0.3, 0.95),
        run: (l, c, ok) => {
          if (ok) { gainExp(l, 80); return good(`${c.n}ล้มลงเป็นครั้งที่สิบแปด แล้วลุกขึ้นอีกเป็นครั้งที่สิบเก้า คุณหยุดเอง "พอแล้ว กลับไปฝึกอีกสิบปี"`); }
          addFame(l, -10);
          const to = ranked(l) ? dropPlace(l, 1) : 0;
          return bad(`เด็กนั่นใช้ท่าของคุณเอง — ที่จำมาจากการแอบดูคุณประลองเมื่อสามปีก่อน — แล้วเอาชนะได้ ทั้งยุทธภพหัวเราะ${to ? ` (อันดับ ${to})` : ""}`);
        },
      },
      { label: "รับเป็นศิษย์แทนการประลอง", run: (l, c) => { addStat(l, "happiness", 6); l.flags.m17Prodigy = String(c.n); return good(`${c.n}อ้าปากค้าง จากนั้นก็คุกเข่าลงในโคลน${addFavor(l, String(c.n), "รับเป็นศิษย์แทนการตัดชื่อ")}`); } },
      { label: "ปิดประตูใส่", run: () => meh("ฝนตกทั้งคืน ตอนเช้าเด็กนั่นยังยืนอยู่ — คุณเปิดประตูอีกที เขาหายไปแล้ว เหลือแต่รอยเท้าลึกในโคลน") },
    ],
  },
  {
    id: "m17.r.tea_master",
    minAge: 20,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => (rankOf(l) >= 3 ? 4 : 0),
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 1, 10))!),
    text: (_l, c) => `${c.label} หนึ่งในสิบยอดฝีมือ มาขอพักที่เรือนของคุณหนึ่งคืน ระหว่างจิบชา เขาถามว่าคุณฝึกมาเพื่ออะไร`,
    choices: [
      { label: "\"เพื่อปกป้องคนที่อ่อนแอกว่า\"", run: (l, c) => { gainExp(l, 120); return good(`${c.n}พยักหน้า แล้วชี้แนะท่าเท้าให้หนึ่งกระบวน "คำตอบดี แต่ระวังจะกลายเป็นคำแก้ตัว"${shiftAlign(l, 3)}`); } },
      { label: "\"เพื่อให้ไม่มีใครเหยียบหัวข้าได้อีก\"", run: (l, c) => { gainExp(l, 120); return meh(`${c.n}หัวเราะ "อย่างน้อยก็ซื่อสัตย์" เขาสาธิตวิธีส่งพลังผ่านปลายเท้าหนึ่งครั้ง แล้วหลับไปเฉยๆ${shiftAlign(l, -2)}`); } },
      { label: "\"เพื่อวันหนึ่งจะเอาชื่อของท่าน\"", tone: "special", show: (l) => rankOf(l) >= 4, run: (l, c) => { gainExp(l, 200); addFame(l, 2); return sys(`${c.n}วางถ้วยชา "งั้นข้าจะสอนให้เจ้าเก่งพอจะมาเอามันไป — จะได้สนุกหน่อย" คืนนั้นทั้งคืน คุณได้เรียนในสิ่งที่สำนักไหนก็ไม่สอน`); } },
    ],
  },
  {
    id: "m17.r.dying_master",
    minAge: 16,
    maxAge: 80,
    weight: (l) => (hasPower(l) ? 3 : 1),
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 3, 10))!),
    title: "ฝากฝังก่อนสิ้นลม",
    text: (_l, c) => `คุณพบ${c.label}นอนจมกองเลือดในป่าไผ่ พิษสีม่วงลามขึ้นถึงคอ เขายื่นคัมภีร์เปื้อนเลือดให้ "ฝาก…ส่งคืนสำนักของข้า…อย่าให้ตกถึงมือ…"`,
    choices: [
      { label: "ฝังศพเขาอย่างสมเกียรติ แล้วเดินทางสามเดือนไปส่งคัมภีร์", run: (l, c) => { removeMaster(l, String(c.id), `${c.label} ถูกลอบสังหารในป่าไผ่`); addFame(l, 8); return good(`ศิษย์ของ${c.n}ร่ำไห้รับคัมภีร์คืน ประตูสำนักของพวกเขาจะเปิดให้คุณเสมอ${givePill(l)}${shiftAlign(l, 8)}${addFavor(l, `สำนักของ${c.n}`, "ส่งคัมภีร์ของอาจารย์คืนสำนัก")}`); } },
      { label: "เปิดอ่านคัมภีร์ก่อนส่ง… แค่บทเดียว", run: (l, c) => { removeMaster(l, String(c.id), `${c.label} ถูกลอบสังหารในป่าไผ่`); gainExp(l, 250); addFame(l, 4); return meh(`คุณอ่านบทแรกจนรุ่งสาง แล้วจึงส่งคืนทั้งเล่ม ไม่มีใครรู้ — นอกจากคุณ${shiftAlign(l, -2)}`); } },
      { label: "เก็บคัมภีร์ไว้เอง", run: (l, c) => { removeMaster(l, String(c.id), `${c.label} หายสาบสูญ คัมภีร์ประจำสำนักหายไปด้วย`); gainExp(l, 500); return bad(`คุณซ่อนคัมภีร์ไว้ใต้พื้นห้อง ทุกคืนคุณฝันเห็นดวงตาของ${c.n}${shiftAlign(l, -12)}${addGrudge(l, `สำนักของ${c.n}`, "ยึดคัมภีร์ที่ผู้ตายฝากไว้")}`); } },
    ],
  },
  {
    id: "m17.r.summit_duel",
    minAge: 12,
    maxAge: 90,
    maxTimes: 3,
    weight: 3,
    prepare: (l) => ({ ...ctxOf(masterAt(l, 1)!), n2: masterAt(l, 2)!.me ? "คุณ" : masterAt(l, 2)!.n, label2: masterAt(l, 2)!.me ? "คุณ" : masterLabel(masterAt(l, 2)!) }),
    when: (l) => !masterAt(l, 1)?.me && !masterAt(l, 2)?.me,
    title: "ศึกยอดเขาหัวซาน",
    text: (_l, c) => `${c.label} อันดับหนึ่ง กับ ${c.label2} อันดับสอง นัดดวลกันบนยอดเขาหัวซานในคืนจันทร์เต็มดวง คนทั้งยุทธภพแห่ไปชม`,
    choices: [
      { label: "ปีนขึ้นไปดูใกล้ๆ เสี่ยงโดนคลื่นลมปราณ", check: { stat: "health", dc: 55 }, run: (l, _c, ok) => { if (ok) { gainExp(l, hasPower(l) ? 300 : 0); addStat(l, "smarts", 3); return good("คุณเห็นกระบี่สองเล่มชนกันแล้วหิมะทั้งยอดเขาลอยขึ้นฟ้า — ความเข้าใจบางอย่างผุดขึ้นในใจ"); } return bad("คลื่นลมปราณกระแทกคุณตกลงไปสามชั้นหิน" + hurt(l, 6, 15, "ถูกคลื่นลมปราณจากศึกยอดเขา")); } },
      { label: "เปิดบ่อนรับแทงพนันข้างล่างเขา", check: { stat: "smarts", dc: 50 }, skill: ["business"], run: (l, c, ok) => { if (ok) { addMoney(l, 400_000); return good(`คุณตั้งราคาต่อรองแม่นจนเจ้ามือบ่อนในเมืองมาขอซื้อตัว (ได้ ${money(l, 400_000)})`); } addMoney(l, -150_000); return bad(`${c.n}ชนะแบบไม่มีใครคาด — ทุกคนแทงถูก ยกเว้นคุณที่เป็นเจ้ามือ`); } },
      { label: "ไม่ไป — ใครชนะก็ไม่เกี่ยวกับข้าวในชาม", run: (l) => { addStat(l, "happiness", 2); return meh("คุณนอนตากลมอยู่บ้าน ได้ยินเสียงกระบี่ดังข้ามมาจากอีกฟากเขา"); } },
    ],
  },
  {
    id: "m17.r.demon_ranked",
    minAge: 20,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (rankOf(l) >= 4 && alignment(l) > -20 ? 4 : 0),
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 4, 9))!),
    when: (l) => masters(l).length >= 9,
    title: "ล่ายอดฝีมือมาร",
    text: (_l, c) => `${c.label} หนึ่งในทำเนียบ ถูกจับได้ว่าดูดลมปราณเด็กกำพร้ามาสามสิบปี พันธมิตรยุทธจักรรวบรวมยอดฝีมือไปล้อมจับ และส่งเทียบเชิญมาถึงคุณ`,
    choices: [
      {
        label: "ร่วมกองล่า และขอเป็นคนนำหน้า",
        tone: "danger",
        odds: (l, c) => masterOdds(l, tgt(l, c), 0.15),
        survival: (l, c) => masterSurvival(l, tgt(l, c), 0.25),
        run: (l, c, ok) => {
          if (ok) { const p = takePlace(l, String(c.id)); removeMaster(l, String(c.id)); addFame(l, 15); return big(`กระบวนท่าของคุณเป็นท่าสุดท้ายที่${c.n}ได้เห็น เด็กๆ ในถ้ำถูกพาออกมาอาบแดด — หอบันทึกยุทธภพยกตำแหน่งให้คุณ: ${placeText(myPlace(l) || p)}${shiftAlign(l, 12)}`); }
          if (!chance(l, masterSurvival(l, tgt(l, c), 0.25))) { kill(l, `ถูกยอดฝีมือมาร${c.label}สังหาร`); return bad("ฝ่ามือดูดวิญญาณจับเข้าที่หน้าอก…"); }
          return bad(`${c.n}หนีรอดไปได้ ทิ้งรอยฝ่ามือสีดำไว้บนตัวคุณ` + hurt(l, 15, 30, "พิษฝ่ามือมาร"));
        },
      },
      { label: "ช่วยอยู่แนวหลัง พาเด็กๆ ออกจากถ้ำ", run: (l, c) => { removeMaster(l, String(c.id), `${c.label} ถูกพันธมิตรยุทธจักรสังหาร`); addFame(l, 5); return good(`คุณอุ้มเด็กสิบสองคนออกมาทีละคน คนสุดท้ายกอดคอคุณไม่ยอมปล่อย${shiftAlign(l, 10)}${addFavor(l, "เด็กกำพร้าจากถ้ำมาร", "พาออกจากถ้ำของยอดฝีมือมาร")}`); } },
      { label: "ปฏิเสธ — ไม่ใช่เรื่องของข้า", run: (l, c) => { removeMaster(l, String(c.id), `${c.label} ถูกพันธมิตรยุทธจักรสังหาร`); return meh(`ได้ข่าวว่ากองล่าเสียคนไปเจ็ด ก่อนจะจับ${c.n}ได้${shiftAlign(l, -3)}`); } },
    ],
  },
  {
    id: "m17.r.epithet",
    minAge: 16,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (ranked(l) ? 12 : 0),
    title: "ฉายาจากปากชาวยุทธ์",
    text: (l) => `นักกวีพเนจรแต่งเพลงเกี่ยวกับคุณ ร้องกันทั่วโรงเตี๊ยมตั้งแต่ลั่วหยางถึงฉางอาน ทุกคนเรียกคุณว่า【${l.flags.m17Epithet}】`,
    choices: [
      { label: "รับไว้ด้วยความภูมิใจ", run: (l) => { addStat(l, "happiness", 6); addFame(l, 3); return good("คุณซื้อสุราเลี้ยงนักกวีหนึ่งไห เขาแต่งเพิ่มอีกสามท่อน"); } },
      { label: "ขอให้เรียกว่า【กระบี่ข้าวต้มปลา】แทน — ฟังแล้วถ่อมตัวดี", run: (l) => { l.flags.m17Epithet = "กระบี่ข้าวต้มปลา"; addStat(l, "happiness", 10); return meh("ทั้งยุทธภพหัวเราะไปครึ่งปี แล้วก็…ติด ตอนนี้ร้านข้าวต้มปลาทุกร้านแขวนรูปคุณ"); } },
      { label: "ขอให้เรียกว่า【มารไร้ปรานี】— ศัตรูจะได้ขยาด", run: (l) => { l.flags.m17Epithet = "มารไร้ปรานี"; addFame(l, -3); return meh(`โจรภูเขาสามกลุ่มยอมแตกทัพหนีเมื่อได้ยินชื่อ ส่วนแม่ค้าในตลาดเริ่มไม่ทอนเงินให้คุณ${shiftAlign(l, -4)}`); } },
    ],
  },
  {
    id: "m17.r.impostor",
    minAge: 20,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (ranked(l) ? 5 : 0),
    text: (l) => `ชายคนหนึ่งเดินทางไปทั่วแคว้น อ้างว่าเป็น【${l.flags.m17Epithet}】ในทำเนียบ เก็บค่าคุ้มครองจากหมู่บ้านละสิบตำลึง และ…ใช้ท่ากระบี่ของคุณผิดหมดทุกท่า`,
    choices: [
      { label: "ตามไปเปิดโปงต่อหน้าชาวบ้าน", check: { stat: "smarts", dc: 50 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { addFame(l, 5); return good(`คุณขอให้เขาร่ายท่าที่ 'ตัวเอง' คิดค้น เขาร่ายผิดตั้งแต่ท่าแรก ชาวบ้านไล่ตีจนตกน้ำ${addFavor(l, "ชาวบ้านสามหมู่บ้าน", "ทวงเงินคืนจากตัวปลอม")}`); } return meh("เขาเห็นคุณก่อนแล้วหนีไปตั้งแต่ไก่ยังไม่ขัน — แต่อย่างน้อยก็ไม่กล้ากลับมา"); } },
      { label: "รับเขาเป็นตัวแทน แบ่งเงินกันครึ่งๆ", run: (l) => { addMoney(l, 120_000); addFame(l, -6); return meh(`ธุรกิจไปได้สวยสองปี จนตัวปลอมไปแพ้โจรกระจอก ชื่อเสียงของคุณพังไปด้วย (ได้ ${money(l, 120_000)})${shiftAlign(l, -6)}`); } },
      { label: "ปล่อยไป — ใครจะเชื่อว่าข้าตัวเตี้ยขนาดนั้น", run: (l) => { addStat(l, "happiness", 2); return meh("ปีต่อมามีคนมาขอลายเซ็นคุณ แล้วบอกว่า 'ตัวจริงดูสูงกว่านี้'"); } },
    ],
  },
  {
    id: "m17.r.crown",
    minAge: 20,
    maxAge: 120,
    maxTimes: 1,
    weight: (l) => (myPlace(l) === 1 ? 25 : 0),
    title: "หนักที่สุดคือมงกุฎ",
    text: () => "ตั้งแต่ขึ้นเป็นอันดับหนึ่ง ทุกเช้ามีสาส์นท้าประลองปักอยู่ที่ประตูไม่ต่ำกว่าสามฉบับ คนที่คุณเคยเรียกว่าเพื่อนเริ่มนับก้าวเวลาเดินเข้าใกล้คุณ",
    choices: [
      { label: "รับคำท้าทุกฉบับ — ใครอยากได้ก็มาเอา", run: (l) => { gainExp(l, 300); addStat(l, "happiness", -6); return meh("คุณสู้สามสิบเจ็ดครั้งในปีเดียว ไม่แพ้เลยสักครั้ง แต่คืนวันเกิดคุณนั่งกินบะหมี่คนเดียว"); } },
      { label: "เปิดลานประลองให้คนรุ่นใหม่ ขึ้นมาเรียนแทนที่จะมาฆ่า", run: (l) => { addFame(l, 10); addStat(l, "happiness", 6); return good(`ผู้ท้าชิงกลายเป็นลูกศิษย์ทีละคน ยอดเขาที่คุณอยู่เริ่มมีเสียงหัวเราะ${shiftAlign(l, 5)}`); } },
      { label: "หายตัวไปจากยุทธภพ ทิ้งไว้แค่ตำนาน", run: (l) => { l.flags.m17Vanished = true; addStat(l, "happiness", 10); return sys("ไม่มีใครรู้ว่าคุณไปไหน ตำนานบอกว่าอันดับหนึ่งที่แท้จริงไม่จำเป็นต้องอยู่ในทำเนียบ — แต่หอบันทึกไม่กล้าลบชื่อคุณ"); } },
    ],
  },
  {
    id: "m17.r.passing_torch",
    minAge: 60,
    maxAge: 120,
    maxTimes: 1,
    weight: (l) => (ranked(l) ? 15 : 0),
    title: "ส่งต่อเปลวไฟ",
    prepare: (l) => ({ n: shortName(createPerson(l, "rival", { age: randInt(l, 22, 30), bond: 40 })) }),
    text: (_l, c) => `${c.n}ยอดฝีมือหนุ่มที่ไล่อันดับขึ้นมาเร็วที่สุดในรอบร้อยปี คุกเข่าหน้าบ้านคุณ "ขอให้ผู้อาวุโสชี้แนะสักหนึ่งกระบวนท่า" — ทั้งคู่รู้ดีว่านี่คือคำท้าอย่างสุภาพ`,
    choices: [
      { label: "สู้ด้วยทุกอย่างที่มี — ไฟสุดท้ายต้องสว่างที่สุด", tone: "danger", odds: (l) => clamp(0.35 + rankOf(l) * 0.05 + (l.stats.health - 50) / 150, 0.1, 0.85), survival: (l) => clamp(0.6 + l.stats.health / 200, 0.5, 0.95), run: (l, c, ok) => { if (ok) { addFame(l, 10); return big(`ท่าสุดท้ายของคุณทำให้${c.n}ร้องไห้ — ไม่ใช่เพราะเจ็บ แต่เพราะมันงดงามเกินไป`); } if (!chance(l, clamp(0.6 + l.stats.health / 200, 0.5, 0.95))) { kill(l, "สิ้นใจอย่างสงบหลังการประลองครั้งสุดท้าย"); return meh("คุณยิ้มตอนล้มลง ลมปราณสุดท้ายถูกส่งผ่านปลายกระบี่ไปถึงคนรุ่นถัดไป"); } dropPlace(l, 10); return meh(`${c.n}ชนะ แล้วประคองคุณลุกขึ้น "ขอบคุณที่ไม่ออมมือ" — คุณหลุดจากทำเนียบด้วยรอยยิ้ม`); } },
      { label: "ยื่นกระบี่ให้เขา แล้วประกาศวางมือ", run: (l, c) => { dropPlace(l, 10); addStat(l, "happiness", 12); addFame(l, 6); return good(`คุณบอก${c.n}ว่า "ชื่อนี้หนักนะ ถือดีๆ" — ปีนั้นหอบันทึกยุทธภพเขียนชื่อคุณไว้ในหน้าตำนานแทนหน้าทำเนียบ${addFavor(l, String(c.n), "มอบตำแหน่งในทำเนียบให้โดยไม่ต้องสู้")}`); } },
    ],
  },
  {
    id: "m17.r.scribe",
    minAge: 18,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (rankOf(l) >= 4 ? 4 : 0),
    title: "หอบันทึกยุทธภพ",
    text: () => "อาลักษณ์จากหอบันทึกยุทธภพมาสัมภาษณ์คุณ ก่อนกลับเขากระแอม \"ปีนี้ค่าหมึกแพงนัก… ถ้ามีคนช่วยค่าหมึก ชื่อบางชื่ออาจเขียนได้ตัวโตขึ้น\"",
    choices: [
      { label: "ยัดเงินใส่แขนเสื้อเขา", show: (l) => l.money >= 500_000 && !!challengeTarget(l), run: (l) => { addMoney(l, -500_000); const t = challengeTarget(l)!; const p = takePlace(l, t.id); addFame(l, -2); return meh(`ปีนั้นชื่อคุณขึ้นไปอยู่อันดับ ${p} โดยไม่ต้องชักกระบี่ ${t.n}อ่านประกาศแล้วบีบถ้วยชาแตก${shiftAlign(l, -8)}${addGrudge(l, t.n, "ซื้ออันดับทำเนียบแซงหน้า")}`); } },
      { label: "\"ชื่อข้าจะตัวโตเพราะกระบี่ ไม่ใช่เพราะเงิน\"", run: (l) => { addFame(l, 4); return good(`อาลักษณ์จดประโยคนั้นลงไป ปีต่อมามันกลายเป็นคำขวัญที่ลานประลองทุกแห่ง${shiftAlign(l, 4)}`); } },
      { label: "แจ้งพันธมิตรยุทธจักรว่าหอบันทึกรับสินบน", check: { stat: "smarts", dc: 55 }, skill: ["social"], run: (l, _c, ok) => { if (ok) { addFame(l, 6); return good(`อาลักษณ์สามคนถูกปลด ทำเนียบปีนั้นถูกเขียนใหม่ทั้งหมด${shiftAlign(l, 6)}`); } return bad(`ไม่มีใครเชื่อ แถมหอบันทึกเขียนชื่อคุณผิดไปสามปีติด${addGrudge(l, "อาลักษณ์หอบันทึก", "แจ้งข้อหารับสินบน")}`); } },
    ],
  },
  {
    id: "m17.r.ten_banquet",
    minAge: 20,
    maxAge: 110,
    maxTimes: 2,
    weight: (l) => (ranked(l) ? 7 : 0),
    title: "งานเลี้ยงสิบยอดฝีมือ",
    prepare: (l) => {
      const npcs = masters(l).filter((m) => !m.me);
      return { a: masterLabel(pick(l, npcs)), b: masterLabel(pick(l, npcs)) };
    },
    text: (_l, c) => `ทุกสิบปี สิบยอดฝีมือจะมานั่งร่วมโต๊ะกันครั้งหนึ่ง ระหว่างงาน ${c.a} กระซิบชวนคุณร่วมมือกันกำจัด ${c.b} ก่อนประกาศทำเนียบปีหน้า`,
    choices: [
      { label: "ปฏิเสธ แล้วเตือนอีกฝ่ายอย่างลับๆ", run: (l, c) => { addStat(l, "happiness", 3); return good(`ผู้ถูกหมายหัวไม่พูดอะไร แค่รินสุราให้คุณจนเต็มถ้วย${shiftAlign(l, 5)}${addFavor(l, String(c.b).replace(/【.*】/, ""), "เตือนเรื่องแผนลอบกำจัดในงานเลี้ยง")}`); } },
      { label: "ร่วมมือ — การเมืองก็เป็นวิชายุทธ์อย่างหนึ่ง", run: (l, c) => { const t = challengeTarget(l); if (t) takePlace(l, t.id); addFame(l, -4); return meh(`ปีถัดมา ${c.b} ป่วยหนักจนต้องถอนตัว ส่วนคุณขยับขึ้นมาหนึ่งอันดับโดยไม่ต้องเหงื่อออก${shiftAlign(l, -10)}${addGrudge(l, String(c.b).replace(/【.*】/, ""), "สมคบคิดกำจัดในงานเลี้ยงสิบยอดฝีมือ")}`); } },
      { label: "ทำเป็นเมา แล้วนอนหลับบนโต๊ะ", run: (l) => { addStat(l, "happiness", 4); return meh("ทุกคนเลิกคุยเรื่องสำคัญต่อหน้าคุณ — แผนเดียวที่ปลอดภัยที่สุดในงานคือแผนของคุณ"); } },
    ],
  },
  {
    id: "m17.r.weakness",
    minAge: 18,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (rankOf(l) >= 4 && challengeTarget(l) ? 4 : 0),
    prepare: (l) => ctxOf(challengeTarget(l)!),
    text: (_l, c) => `หมอแก่ที่คุณเคยช่วยไว้กระซิบว่า ${c.label} มีแผลเก่าที่ชายโครงซ้าย ทุกครั้งที่ฝนตก ลมปราณของเขาจะติดขัดหนึ่งลมหายใจ`,
    choices: [
      { label: "รอวันฝนตก แล้วส่งสาส์นท้า", tone: "danger", odds: (l, c) => masterOdds(l, tgt(l, c), 0.2), survival: (l, c) => masterSurvival(l, tgt(l, c), 0.2), run: (l, c, ok) => { l.flags.m17LastChallenge = l.age; if (ok) return big(`ฟ้าร้องครั้งที่สาม ${c.n}ชะงักครึ่งลมหายใจ — ครึ่งลมหายใจนั้นพอแล้ว${winAgainst(l, c)}${shiftAlign(l, -3)}`); if (mayDie(l, masterSurvival(l, tgt(l, c), 0.2), `พ่ายแพ้ต่อ${c.label}กลางสายฝน`)) return bad("เขารู้ตัวมาตลอด และรอคุณอยู่…"); return bad(`${c.n}หัวเราะกลางฝน "เจ้าคิดว่าแผลเก่าสามสิบปี ข้าจะไม่รู้วิธีแก้?"` + hurt(l, 10, 22, "บาดเจ็บกลางสายฝน")); } },
      { label: "บอกเขาตรงๆ ว่ามีคนรู้จุดอ่อน", run: (l, c) => { addFame(l, 3); return good(`${c.n}นิ่งไปนาน แล้วคารวะคุณอย่างลึก${shiftAlign(l, 6)}${addFavor(l, String(c.n), "เตือนว่าจุดอ่อนรั่วไหล")}`); } },
      { label: "ขายข่าวให้คู่แข่งของเขา", run: (l, c) => { addMoney(l, 800_000); return meh(`ได้ ${money(l, 800_000)} ปีต่อมา ${c.n}แพ้ให้ใครบางคนกลางสายฝน${shiftAlign(l, -10)}${addGrudge(l, String(c.n), "ขายจุดอ่อนให้ศัตรู")}`); } },
    ],
  },
  {
    id: "m17.r.rival_ranked",
    minAge: 20,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (l.flags.childRival && hasPower(l) ? 6 : 0),
    title: "คู่ปรับวัยเด็กติดทำเนียบ",
    text: (l) => `ประกาศหอบันทึกปีนี้มีชื่อใหม่ — ${l.flags.childRival} เด็กที่เคยผลักคุณตกโคลนที่ท่าน้ำ ตอนนี้ได้ฉายาว่า【พยัคฆ์ท่าน้ำ】และกำลังพูดถึงคุณในทุกโรงเตี๊ยม`,
    choices: [
      { label: "ส่งโคลนหนึ่งถังไปเป็นของขวัญแสดงความยินดี", run: (l) => { addStat(l, "happiness", 8); return meh("เขาส่งปลาหนึ่งตะกร้ากลับมา พร้อมโน้ตว่า 'ยังโกรธอยู่เหรอ' — คุณหัวเราะออกมาเป็นครั้งแรกในรอบปี"); } },
      { label: "ไปหาเขาเพื่อปิดบัญชีเก่า", tone: "danger", odds: (l) => fightOdds2(l), run: (l, _c, ok) => { if (ok) { addFame(l, 6); delete l.flags.childRival; return good("ครั้งนี้คนที่ตกโคลนคือเขา และทั้งเมืองหัวเราะเหมือนวันนั้น — คุณยื่นมือดึงเขาขึ้นมา แค้นยี่สิบปีจบลงในโคลนนั่นเอง"); } return bad("เขาโตขึ้นจริงๆ — คุณตกโคลนอีกรอบ เหมือนวันนั้นทุกอย่าง" + hurt(l, 5, 15, "แพ้คู่ปรับวัยเด็ก")); } },
    ],
  },
  {
    id: "m17.r.drunk_master",
    minAge: 16,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (hasPower(l) ? 3 : 0),
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 1, 10))!),
    when: (l) => masters(l).some((m) => !m.me),
    text: (_l, c) => `ชายเมาเละในโรงเตี๊ยมท้าทุกคนดวลดื่ม ใครชนะได้ "ท่าเด็ด" หนึ่งท่า — ผ้าคลุมเขาเลื่อนลง คุณเห็นป้ายหยกประจำตัวของ ${c.label}`,
    choices: [
      { label: "นั่งลงดวลดื่ม", check: { stat: "health", dc: 60 }, run: (l, c, ok) => { if (ok) { gainExp(l, 220); return good(`${c.n}ฟุบไปหลังไหที่สิบ ก่อนหลับเขาใช้นิ้วจุ่มสุราวาดท่ากระบี่ลงบนโต๊ะ — คุณจำได้ทุกเส้น`); } addStat(l, "health", -4); return meh(`คุณตื่นมาในคอกหมู ส่วน${c.n}หายไปแล้ว ทิ้งค่าสุราไว้ให้คุณจ่าย`); } },
      { label: "พยุงเขาไปนอนที่ห้อง ไม่ถือโอกาส", run: (l, c) => { addStat(l, "happiness", 3); return good(`เช้ามาเขาจำอะไรไม่ได้เลย แต่ทิ้งป้ายไม้แกะสลักไว้ข้างหมอน${addFavor(l, String(c.n), "พยุงไปนอนตอนเมาโดยไม่ฉวยโอกาส")}`); } },
      { label: "ขโมยป้ายหยกไปขาย", skill: ["stealth"], check: { stat: "luck", dc: 55 }, run: (l, c, ok) => { if (ok) { addMoney(l, 300_000); return meh(`ป้ายหยกขายได้ ${money(l, 300_000)}${shiftAlign(l, -6)}${addGrudge(l, String(c.n), "ขโมยป้ายหยกตอนเมา")}`); } return bad(`มือของ${c.n}จับข้อมือคุณไว้ทั้งที่ตายังหลับ "เด็กสมัยนี้…" — แขนคุณใช้การไม่ได้ไปครึ่งเดือน` + hurt(l, 5, 12, "ถูกยอดฝีมือหักแขน")); } },
    ],
  },
  {
    id: "m17.r.master_proposal",
    minAge: 18,
    maxAge: 40,
    maxTimes: 1,
    weight: (l) => (rankOf(l) >= 3 && !people(l, "spouse").length && !people(l, "partner").length ? 3 : 0),
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 1, 10))!),
    when: (l) => masters(l).some((m) => !m.me),
    title: "ทายาทของยอดฝีมือ",
    text: (l, c) => `${c.label} ส่งแม่สื่อมาพร้อมของหมั้นสิบหีบ — ${l.gender === "m" ? "บุตรสาว" : "บุตรชาย"}ของเขาเห็นคุณประลองเมื่อปีก่อน แล้วไม่ยอมกินข้าวมาสามวัน`,
    choices: [
      { label: "ไปพบตัวก่อนตัดสินใจ", check: { stat: "looks", dc: 50 }, skill: ["social"], run: (l, c, ok) => { if (ok) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age - randInt(l, 0, 4), bond: 70, job: `ทายาทของ${c.n}` }); return good(`${shortName(p)}พูดตรงกว่าที่คิด "ข้าไม่ได้ชอบหน้าเจ้า ข้าชอบท่าเท้าตอนเจ้าหลบ" — คุณรู้ทันทีว่าจะไม่มีวันเบื่อคนนี้`); } return meh("การพบกันจบลงด้วยการเถียงเรื่องท่ากระบี่ทั้งบ่าย ทั้งสองฝ่ายตกลงว่าเป็นศัตรูกันดีกว่า"); } },
      { label: "ปฏิเสธอย่างสุภาพ", run: (l, c) => { addFame(l, -1); return meh(`${c.n}ส่งของหมั้นกลับมาเพิ่มเป็นยี่สิบหีบ คุณต้องส่งคืนอีกรอบ — ทั้งสองบ้านเหนื่อยไปตามๆ กัน`); } },
    ],
  },
  {
    id: "m17.r.betting_house",
    minAge: 18,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => (rankOf(l) >= 4 && challengeTarget(l) ? 3 : 0),
    text: (l) => `บ่อนพนันในลั่วหยางเปิดราคาว่าปีนี้คุณจะติด${myPlace(l) ? "อันดับสูงขึ้น" : "ทำเนียบ"}ได้ไหม ราคาต่อรอง ${myPlace(l) ? "หนึ่งต่อสาม" : "หนึ่งต่อห้า"} — ไม่มีใครแทงข้างคุณเลย`,
    choices: [
      { label: "แทงข้างตัวเอง แล้วไปท้าประลองทันที", tone: "danger", show: (l) => l.money >= 200_000, odds: (l) => masterOdds(l, challengeTarget(l)!), survival: (l) => masterSurvival(l, challengeTarget(l)!, 0.15), run: (l, _c, ok) => { const t = challengeTarget(l)!; const mult = myPlace(l) ? 3 : 5; addMoney(l, -200_000); l.flags.m17LastChallenge = l.age; if (ok) { addMoney(l, 200_000 * mult); return big(`คุณชนะ${masterLabel(t)} เจ้ามือบ่อนเป็นลม (ได้ ${money(l, 200_000 * mult)})${winAgainst(l, ctxOf(t))}`); } if (mayDie(l, masterSurvival(l, t, 0.15), `พ่ายแพ้ต่อ${masterLabel(t)}`)) return bad("เงินเดิมพันสุดท้ายในชีวิตคุณ…"); return bad("เสียทั้งเงิน เสียทั้งหน้า" + hurt(l, 8, 18, "แพ้ประลองหลังแทงพนัน")); } },
      { label: "เดินผ่านไป — ข้าไม่ใช่ม้าแข่ง", run: () => meh("เจ้ามือบ่อนตะโกนตามหลังว่าจะลดราคาให้ คุณไม่หันกลับไป") },
    ],
  },
  {
    id: "m17.r.never_ranked",
    minAge: 60,
    maxAge: 110,
    maxTimes: 1,
    weight: (l) => (rankOf(l) >= 4 && !wasRanked(l) ? 6 : 0),
    text: () => "คุณเปิดอ่านประกาศทำเนียบปีนี้ ไม่มีชื่อคุณ — เหมือนทุกปีตลอดสี่สิบปีที่ผ่านมา หลานในบ้านถามว่าคุณเสียใจไหม",
    choices: [
      { label: "\"ทำเนียบมีสิบชื่อ แต่ใต้หล้ามีคนนับล้าน\"", run: (l) => { addStat(l, "happiness", 10); return good("หลานพยักหน้าแบบไม่เข้าใจ แล้วขอให้คุณสอนกระบี่ — ที่จริงแค่นั้นก็พอแล้ว"); } },
      { label: "แอบร้องไห้ในห้อง แล้วออกมาซ้อมกระบี่ต่อ", run: (l) => { gainExp(l, 100); addStat(l, "happiness", -2); return meh("เสียงกระบี่ดังจนดึก หลานแอบดูจากหน้าต่าง แล้วจำท่านั้นไปตลอดชีวิต"); } },
    ],
  },
  {
    id: "m17.r.tribulation_eve",
    minAge: 30,
    maxAge: 200,
    maxTimes: 2,
    weight: (l) => (rankOf(l) === 7 ? 14 : 0),
    title: "คืนก่อนทัณฑ์สวรรค์",
    text: (l) => `เมฆดำเริ่มก่อตัวเหนือยอดเขาที่คุณเลือกรับทัณฑ์สวรรค์ ${myPlace(l) ? "ยอดฝีมือในทำเนียบหลายคน" : "คนที่รู้จักคุณ"}เดินทางมาถึงตีนเขาโดยไม่ได้นัดหมาย — บางคนมาช่วย บางคนมาดูว่าคุณจะตายอย่างไร`,
    choices: [
      { label: "ขอยาจากคนที่เคยติดหนี้บุญคุณ", show: (l) => openEntries(l, "f").length > 0, run: (l) => { const e = openEntries(l, "f")[0]; settle(l, e.id, "ส่งยาวิเศษมาช่วยรับทัณฑ์สวรรค์"); l.power!.items.push("ยาเม็ดเก้าหยาง"); return good(`${e.n}ปีนเขามาทั้งคืนพร้อมกล่องยาที่เก็บไว้ทั้งชีวิต "วันที่ท่าน${e.w} ข้าสาบานว่าจะตอบแทนในวันที่สำคัญที่สุด" — ได้「ยาเม็ดเก้าหยาง」`); } },
      { label: "แลกหมัดกับยอดฝีมือที่มาดู เพื่อขัดเกลาลมปราณครั้งสุดท้าย", odds: (l) => clamp(0.4 + (l.stats.health - 50) / 100, 0.15, 0.85), run: (l, _c, ok) => { if (ok) { gainExp(l, 600); return good(`สามวันสามคืนบนลานหิน คุณรู้จักจุดอ่อนของลมปราณตัวเองครบทุกจุด${givePill(l, 7)}`); } return bad("คุณเจ็บก่อนทัณฑ์สวรรค์จะมาเสียอีก" + hurt(l, 8, 16, "บาดเจ็บก่อนรับทัณฑ์สวรรค์")); } },
      { label: "ไล่ทุกคนกลับ — ฟ้าจะผ่าก็ผ่าข้าคนเดียว", run: (l) => { addStat(l, "happiness", 6); gainExp(l, 200); return meh(`ตีนเขาเงียบลง เหลือแต่คุณกับเสียงฟ้าร้องไกลๆ — ใจที่นิ่งอาจเป็นยาที่ดีที่สุด${shiftAlign(l, 2)}`); } },
    ],
  },
  {
    id: "m17.r.tomb_of_ten",
    minAge: 30,
    maxAge: 110,
    maxTimes: 1,
    weight: (l) => (wasRanked(l) ? 3 : 0),
    title: "สุสานทำเนียบ",
    text: () => "บนเขาซงซานมีสุสานของคนที่เคยติดทำเนียบ ป้ายหินเรียงกันนับพัน ส่วนใหญ่ตายก่อนอายุสี่สิบ คุณพบช่องว่างที่ยังไม่ได้สลักชื่อ",
    choices: [
      { label: "สลักชื่อตัวเองไว้ล่วงหน้า", run: (l) => { addStat(l, "happiness", 4); return meh("ช่างแกะหินถามว่าจะใส่ปีตายด้วยไหม คุณบอกให้เว้นไว้ — 'อีกนานโว้ย'"); } },
      { label: "ไหว้ทุกป้าย ทีละป้าย", run: (l) => { addStat(l, "smarts", 3); return good(`ใช้เวลาสามวันสามคืน ระหว่างทางคุณเรียนรู้ว่ายอดฝีมือส่วนใหญ่ไม่ได้ตายเพราะแพ้ แต่ตายเพราะไม่ยอมหยุด${shiftAlign(l, 3)}`); } },
    ],
  },
];

// ───── ตัวช่วยท้ายไฟล์ ─────

function fightOdds2(l: Life) {
  return clamp(0.45 + rankOf(l) * 0.04 + (l.stats.health - 50) / 200, 0.1, 0.9);
}
