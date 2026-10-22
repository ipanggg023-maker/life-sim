// ทำเนียบยอดฝีมือ (เขียนใหม่) — ใช้ระบบอันดับใน m17core: ท้าขึ้น ถูกท้า ฉายา ตัวปลอม บนสุด และวันวางมือ
// % ทุกตัวมาจาก masterOdds = ฝีมือจริงของคุณเทียบกับยอดฝีมือคนนั้น
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, money } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import {
  EPITHETS, type Master, challengeTarget, dropPlace, givePill, hurt, masterAt, masterLabel, masterOdds, masterSurvival, masters, myPlace, npcName, rankOf, shiftAlign, takePlace,
} from "../m17core";

const ranked = (l: Life) => myPlace(l) > 0;
const tgt = (l: Life, c: Ctx): Master => masters(l).find((m) => m.id === c.id) ?? { id: String(c.id), n: String(c.n), e: String(c.e), a: Number(c.a), cp: Number(c.cp) };
const ctxOf = (m: Master, extra: Ctx = {}): Ctx => ({ id: m.id, n: m.n, e: m.e, a: m.a, cp: m.cp, label: masterLabel(m), ...extra });
const place = (p: number) => (p ? `อันดับ ${p} ของทำเนียบ` : "นอกทำเนียบ");
const ok = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

export const RANKING_EVENTS: GameEvent[] = [
  {
    id: "rk.news",
    minAge: 8,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: (l) => !!l.flags.m17News || (!!l.power && rankOf(l) >= 3 && l.age % 4 === 0),
    text: (l) => {
      const top = masters(l).slice(0, 3).map((m, i) => `${i + 1}. ${m.me ? "คุณ" : masterLabel(m)}`).join(" · ");
      const news = String(l.flags.m17News ?? "").split("|").filter(Boolean);
      return `📜 หอบันทึกยุทธภพติดประกาศทำเนียบสิบยอดฝีมือ — ${top}${news.length ? ` | ${news.join(" · ")}` : ""}${myPlace(l) ? ` | ชื่อคุณอยู่${place(myPlace(l))}` : ""}`;
    },
    auto: (l) => { delete l.flags.m17News; return "normal"; },
  },
  {
    id: "rk.glimpse",
    minAge: 6,
    maxAge: 14,
    weight: 5,
    prepare: (l) => ctxOf(masterAt(l, randInt(l, 1, 6)) ?? masters(l)[0]),
    title: "คนดังในร้านน้ำชา",
    text: (_l, c) => `ชายวัยกลางคนสวมงอบนั่งจิบชาอยู่มุมร้าน ผู้ใหญ่ทั้งร้านกระซิบกันว่านั่นคือ ${c.label} หนึ่งในสิบยอดฝีมือใต้หล้า — เขาดูธรรมดามาก เหมือนลุงข้างบ้าน`,
    choices: [
      { label: "ยกกาน้ำชาไปเติมให้", run: (l, c) => { l.flags.m17Idol = String(c.label); addStat(l, "happiness", 5); return ok(`${c.n}มองมือคุณแล้วพูดว่า "มือนิ่งดี" — คุณไม่ล้างมือไปสามวัน`); } },
      { label: "แอบตามไปดูเขาฝึก", check: { stat: "luck", dc: 50 }, run: (l, c, s) => { if (s) { l.flags.m17Idol = String(c.label); addStat(l, "smarts", 2); l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 1; return ok("ริมลำธาร ใบไผ่ทั้งกอร่วงลงพร้อมกันโดยไม่มีลม — ภาพนั้นติดตาคุณทั้งชีวิต"); } return meh(`${c.n}หันมาตอนคุณเหยียบกิ่งไม้ "กลับบ้านไปกินข้าว" — สายตาเดียวทำขาคุณอ่อน`); } },
    ],
  },
  {
    id: "rk.challenge",
    minAge: 16,
    maxAge: 90,
    maxTimes: 0,
    weight: (l) => (!!l.power && rankOf(l) >= 4 && challengeTarget(l) && Number(l.flags.m17LastChallenge ?? -9) < l.age - 1 ? 8 : 0),
    prepare: (l) => ctxOf(challengeTarget(l)!, { pl: masters(l).findIndex((m) => m.id === challengeTarget(l)!.id) + 1 }),
    title: "ขั้นถัดไปของทำเนียบ",
    text: (l, c) => `${myPlace(l) ? `ตอนนี้คุณอยู่${place(myPlace(l))}` : "ชื่อคุณยังไม่อยู่ในทำเนียบ"} — คนถัดไปคือ ${c.label} อายุ ${c.a} ปี อันดับ ${c.pl} ใครชนะคนนั้น ได้ที่นั่งนั้นไป`,
    choices: [
      {
        label: "ส่งสาส์นท้าบนยอดเขา ถึงตายไม่ว่า",
        tone: "danger",
        odds: (l, c) => masterOdds(l, tgt(l, c)),
        survival: (l, c) => masterSurvival(l, tgt(l, c), 0.1),
        run: (l, c, s) => {
          l.flags.m17LastChallenge = l.age;
          if (s) { const p = takePlace(l, String(c.id)); addFame(l, p <= 3 ? 12 : 6); gainExp(l, 200); return { text: `ปลายอาวุธของคุณหยุดห่างคอ${c.n}เพียงเส้นผม — เขาวางอาวุธลง ชื่อคุณขึ้นเป็น${place(p)}${p <= 3 ? givePill(l, 6) : ""}`, kind: "milestone" }; }
          if (!chance(l, masterSurvival(l, tgt(l, c), 0.1))) { kill(l, `พ่ายต่อ${c.label}บนยอดเขา`); return no(`${c.n}ไม่ยั้งมือ — บนยอดเขานั้น การประลองไม่ใช่เกม`); }
          const to = myPlace(l) ? dropPlace(l, 1) : 0;
          gainExp(l, 120);
          return no(`คุณแพ้ต่อหน้าคนนับพัน${to ? ` ตกไปอยู่อันดับ ${to}` : ""}` + hurt(l, 12, 28, `บาดเจ็บจากการท้า${c.label}`));
        },
      },
      {
        label: "ขอประลองแบบแตะแล้วหยุด",
        odds: (l, c) => masterOdds(l, tgt(l, c), -0.08),
        run: (l, c, s) => {
          l.flags.m17LastChallenge = l.age;
          if (s) { const p = takePlace(l, String(c.id)); addFame(l, 5); gainExp(l, 150); return ok(`ปลายกระบี่ของคุณแตะไหล่${c.n}ก่อน — เขาหัวเราะแล้วคารวะ ชื่อคุณขึ้นเป็น${place(p)}`); }
          gainExp(l, 100);
          return no(`${c.n}แตะหน้าผากคุณสามครั้งก่อนคุณจะแตะเขาได้ครั้งเดียว — แพ้อย่างสะอาด แต่เจ็บใจ`);
        },
      },
      { label: "ยังไม่ถึงเวลา", run: (l) => { gainExp(l, 40); return meh("คุณกลับไปฝึกต่อ — ทำเนียบไม่หนีไปไหน"); } },
    ],
  },
  {
    id: "rk.defend",
    minAge: 18,
    maxAge: 100,
    maxTimes: 0,
    weight: (l) => (ranked(l) ? 5 : 0),
    prepare: (l) => {
      const list = masters(l);
      const me = list.findIndex((m) => m.me);
      return ctxOf(list[me + 1] ?? { id: "outsider", n: npcName(l), e: pick(l, EPITHETS), a: randInt(l, 22, 40), cp: list[me].cp - randInt(l, 0, 12) });
    },
    title: "คำท้าถึงหน้าบ้าน",
    text: (l, c) => `ลูกดอกพร้อมสาส์นปักลงบนประตูบ้าน — ${c.label} ขอชิง${place(myPlace(l))}ของคุณภายในเดือนนี้`,
    choices: [
      {
        label: "รับคำท้า",
        tone: "danger",
        odds: (l, c) => masterOdds(l, tgt(l, c), 0.05),
        survival: (l, c) => masterSurvival(l, tgt(l, c), 0.15),
        run: (l, c, s) => {
          if (s) { addFame(l, 5); gainExp(l, 150); return ok(`คุณปัดกระบวนท่าทั้งหมดของ${c.n}ออกไปได้ — เขาคุกเข่า "ข้ายังไม่ถึง" คุณรักษา${place(myPlace(l))}ไว้ได้`); }
          if (!chance(l, masterSurvival(l, tgt(l, c), 0.15))) { kill(l, `ถูก${c.label}ชิงอันดับ`); return no("ฝ่ามือสุดท้ายหนักเกินกว่าที่ร่างกายจะรับไหว…"); }
          const to = dropPlace(l, 1);
          return no(`${c.n}ชนะ — ${to ? `คุณตกไปอยู่อันดับ ${to}` : "ชื่อคุณหลุดจากทำเนียบ"}` + hurt(l, 8, 20, "บาดเจ็บจากการป้องกันอันดับ"));
        },
      },
      { label: "ไม่รับ — ทำเนียบไม่ใช่ทั้งชีวิต", run: (l) => { const to = dropPlace(l, 1); addFame(l, -4); addStat(l, "happiness", 3); return meh(`ข่าวว่าคุณ "หนี" แพร่ไปทั่ว${to ? ` อันดับตกเป็น ${to}` : " ชื่อหลุดจากทำเนียบ"} — แต่คืนนั้นคุณนอนหลับสบาย`); } },
      { label: "เชิญมาดื่มสุราแล้วตัดสินด้วยหมากล้อม", check: { stat: "smarts", dc: 60 }, run: (l, c, s) => { if (s) { addFame(l, 3); return ok(`คุณชนะหมากล้อมเจ็ดสิบสามตา ${c.n}หัวเราะจนสุรากระเด็น แล้วถอนคำท้า`); } const to = dropPlace(l, 1); return meh(`${c.n}ชนะหมากล้อม และยืนยันว่ามันนับ — หอบันทึกยุทธภพก็เห็นด้วย${to ? ` (อันดับ ${to})` : " (หลุดทำเนียบ)"}`); } },
    ],
  },
  {
    id: "rk.epithet",
    minAge: 16,
    maxAge: 90,
    weight: (l) => (ranked(l) && !!l.flags.m17Epithet ? 10 : 0),
    title: "ฉายา",
    text: (l) => `นักกวีเร่ร่อนแต่งเพลงถึงคุณ ร้องกันในโรงเตี๊ยมทั่วแผ่นดิน — ทุกคนเรียกคุณว่า【${l.flags.m17Epithet}】`,
    choices: [
      { label: "รับไว้", run: (l) => { addStat(l, "happiness", 5); addFame(l, 3); return ok("คุณเลี้ยงสุรานักกวีหนึ่งไห เขาแต่งเพิ่มอีกสามท่อน"); } },
      { label: "ขอให้เรียกว่า【กระบี่ข้าวต้มปลา】แทน", run: (l) => { l.flags.m17Epithet = "กระบี่ข้าวต้มปลา"; addStat(l, "happiness", 8); return meh("ยุทธภพหัวเราะไปครึ่งปี แล้วก็…ติด ร้านข้าวต้มปลาทุกร้านแขวนรูปคุณ"); } },
      { label: "ขอให้เรียกว่า【มารไร้ปรานี】", run: (l) => { l.flags.m17Epithet = "มารไร้ปรานี"; addFame(l, -3); return meh(`โจรภูเขาแตกทัพเมื่อได้ยินชื่อ — แม่ค้าในตลาดก็เริ่มไม่ทอนเงินให้คุณ${shiftAlign(l, -4)}`); } },
    ],
  },
  {
    id: "rk.impostor",
    minAge: 20,
    maxAge: 90,
    weight: (l) => (ranked(l) ? 4 : 0),
    title: "ตัวปลอม",
    text: (l) => `มีคนอ้างตัวเป็น【${l.flags.m17Epithet ?? "คุณ"}】เก็บค่าคุ้มครองจากหมู่บ้านละสิบตำลึง — และใช้ท่าของคุณผิดทุกท่า`,
    choices: [
      { label: "ไปเปิดโปงต่อหน้าชาวบ้าน", check: { stat: "smarts", dc: 50 }, run: (l, _c, s) => { if (s) { addFame(l, 4); return ok("คุณขอให้เขาร่ายท่าที่ 'ตัวเอง' คิด — ผิดตั้งแต่ท่าแรก ชาวบ้านไล่ตีจนตกน้ำ"); } return meh("เขาหนีไปก่อนคุณมาถึง — แต่ก็ไม่กล้ากลับมาอีก"); } },
      { label: "รับเป็นตัวแทน แบ่งเงินครึ่งหนึ่ง", run: (l) => { addMoney(l, 120_000); addFame(l, -6); return meh(`ธุรกิจไปได้สองปี จนตัวปลอมแพ้โจรกระจอก ชื่อคุณพังตาม (ได้ ${money(l, 120_000)})${shiftAlign(l, -5)}`); } },
      { label: "ปล่อยไป", run: (l) => { addStat(l, "happiness", 2); return meh("ปีต่อมามีคนมาขอดูหน้าคุณ แล้วบอกว่า 'ตัวจริงดูสูงกว่านี้'"); } },
    ],
  },
  {
    id: "rk.summit",
    minAge: 30,
    maxAge: 100,
    weight: (l) => (myPlace(l) === 1 ? 6 : 0),
    title: "หนึ่งเดียวใต้หล้า",
    text: () => "คุณอยู่บนสุดของทำเนียบมาหนึ่งปีเต็ม ไม่มีใครกล้าท้า ทุกเช้าคุณฝึกคนเดียวบนยอดเขา — และเริ่มสงสัยว่าเหนือขึ้นไปกว่านี้มีอะไร",
    choices: [
      { label: "ลงจากเขาไปสอนคนรุ่นใหม่", run: (l) => { addFame(l, 4); addStat(l, "happiness", 6); return ok("ที่ลานวัดเล็กๆ มีเด็กสิบคนตั้งท่าม้าตามคุณ — ความเหงาบนยอดเขาหายไปในเสียงหัวเราะ"); } },
      { label: "ตามหาคู่ต่อสู้นอกแผ่นดิน", odds: (l) => Math.min(0.9, 0.4 + rankOf(l) * 0.06), run: (l, _c, s) => { if (s) { gainExp(l, 1500); return { text: "สามปีข้ามทะเลทรายและภูเขาหิมะ — คุณกลับมาพร้อมวิชาที่ไม่มีใครในแผ่นดินเคยเห็น", kind: "milestone" }; } return no("ทะเลทรายไม่เคารพทำเนียบ — คุณกลับมาครึ่งตาย" + hurt(l, 15, 25, "การเดินทางนอกแผ่นดิน")); } },
      { label: "ปิดประตูฝึกจนกว่าจะพบทาง", run: (l) => { gainExp(l, 800); addStat(l, "happiness", -4); return meh("ปีนั้นคุณไม่ได้คุยกับใครเลย — แต่ลมปราณลึกขึ้นอีกชั้น"); } },
    ],
  },
  {
    id: "rk.betting",
    minAge: 18,
    maxAge: 80,
    weight: (l) => (ranked(l) ? 3 : 0),
    title: "บ่อนพนันทำเนียบ",
    text: () => "บ่อนใหญ่ในเมืองหลวงเปิดรับพนันผลการประลองทำเนียบ — เจ้าของบ่อนส่งคนมาเสนอเงินก้อนใหญ่ ถ้าคุณยอม 'แพ้' ในการประลองครั้งหน้า",
    choices: [
      { label: "รับเงิน แล้วแพ้ตามนัด", run: (l) => { addMoney(l, 300_000); const to = dropPlace(l, 2); addFame(l, -5); return meh(`เงินเต็มหีบ — ชื่อคุณตกไป${to ? `อยู่อันดับ ${to}` : "จนหลุดทำเนียบ"} และคนในยุทธภพเริ่มกระซิบ${shiftAlign(l, -6)}`); } },
      { label: "ปฏิเสธ แล้วชนะให้ดู", run: (l) => { addFame(l, 3); return ok(`เจ้าของบ่อนขาดทุนหนัก — และจำชื่อคุณได้${shiftAlign(l, 3)}`); } },
    ],
  },
  {
    id: "rk.retire",
    minAge: 55,
    maxAge: 110,
    weight: (l) => (ranked(l) ? 5 : 0),
    title: "วางมือ",
    text: (l) => `คุณอยู่ในทำเนียบมาหลายปี ร่างกายเริ่มบอกว่าพอแล้ว — คนรุ่นใหม่ที่${place(myPlace(l) + 1)}รออยู่ทุกวัน`,
    choices: [
      { label: "ประกาศวางมือ มอบที่ให้คนรุ่นใหม่", run: (l) => { const to = dropPlace(l, 10); addFame(l, 6); addStat(l, "happiness", 8); l.flags.m17Retired = true; return { text: `คุณถอดชื่อออกจากทำเนียบด้วยตัวเอง${to ? "" : ""} — ยุทธภพจดจำคุณในฐานะคนที่รู้ว่าเมื่อไรควรหยุด`, kind: "milestone" }; } },
      { label: "ยังไม่ถึงเวลา", run: () => meh("คุณตื่นมาฝึกเหมือนทุกเช้า เข่าลั่นดังกว่าเดิม") },
    ],
  },
];
