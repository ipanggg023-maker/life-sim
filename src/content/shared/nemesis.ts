// คู่ปรับประจำชีวิต: เจอกันตั้งแต่เด็ก โตไปพร้อมกัน ปะทะกันเป็นช่วงๆ
// สุดท้ายกลายเป็นศัตรูที่ต้องสู้กันถึงตาย หรือเพื่อนที่เข้าใจกันที่สุด
// บางชีวิต คู่ปรับคือ "ผู้ย้อนเวลาอีกคน" ที่จำอนาคตได้เหมือนคุณ
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person, WorldId } from "../../engine/types";
import { addFame, addMoney, addStat, checkChance, clamp, createPerson, shortName } from "../../engine/util";
import { gainExp, luckyRankUp, markTurn } from "../hunter/power";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const W = <T>(l: Life, t: Record<WorldId, T>): T => t[l.worldId ?? "hunter"];

export const nemesisOf = (l: Life): Person | undefined => l.people.find((p) => p.id === l.flags.nemesisId && p.alive);
const stage = (l: Life) => (l.flags.nemesisStage as "rival" | "enemy" | "friend" | undefined) ?? "rival";
const edge = (l: Life) => Number(l.flags.nemEdge ?? 4);
const score = (l: Life) => Number(l.flags.nemScore ?? 0);
const lastClash = (l: Life) => Number(l.flags.nemLast ?? 0);

/** โอกาสชนะคู่ปรับ: มีพลังแล้วเทียบพลังต่อสู้ · ยังไม่มีเทียบสติปัญญา/ร่างกาย */
function winOdds(l: Life, mod = 0): number {
  if (l.power) return clamp(0.5 - edge(l) / 30 + mod, 0.08, 0.92);
  const stat = l.stats.smarts >= l.stats.health ? "smarts" : "health";
  return clamp(checkChance(l, stat, 50 + edge(l) * 2) + mod, 0.08, 0.92);
}

/** ชนะแล้วคู่ปรับจะไปฝึกหนักขึ้น · แพ้แล้วเขาจะชะล่าใจ */
function settle(l: Life, won: boolean) {
  l.flags.nemScore = score(l) + (won ? 1 : -1);
  l.flags.nemEdge = clamp(edge(l) + (won ? 2 : -1), -6, 14);
  l.flags.nemLast = l.age;
}


export const NEMESIS_EVENTS: GameEvent[] = [
  {
    id: "nemesis.meet",
    minAge: 7,
    maxAge: 11,
    weight: 40,
    when: (l) => !l.flags.nemesisId,
    title: "คู่ปรับ",
    prepare: (l) => {
      const p = createPerson(l, "rival", { age: l.age, bond: 25, job: "คู่ปรับตลอดกาล" });
      l.flags.nemesisId = p.id;
      l.flags.nemLast = l.age;
      if (chance(l, 0.2)) l.flags.nemRegressor = true; // ผู้ย้อนเวลาอีกคน (ยังไม่เปิดเผย)
      return { name: shortName(p) };
    },
    text: (l, c) =>
      W(l, {
        hunter: `เด็กใหม่ที่ย้ายมาห้องคุณชื่อ ${c.name} สอบได้ที่หนึ่งตั้งแต่เทอมแรก แล้วหันมามองคุณเหมือนรู้จักกันมานาน "นายคือคนที่ฉันต้องชนะ"`,
        tower: `เด็กใหม่ที่ย้ายมาห้องคุณชื่อ ${c.name} ประกาศหน้าห้องว่าจะเป็นคนแรกของรุ่นที่ได้คำเชิญจากหอคอย แล้วชี้มาที่คุณ "ส่วนนายคือคู่แข่งของฉัน"`,
        apocalypse: `เด็กใหม่ที่ย้ายมาห้องคุณชื่อ ${c.name} สอบได้ที่หนึ่งตั้งแต่เทอมแรก แล้วหันมามองคุณ "นายคือคนที่ฉันต้องชนะ"`,
        ordinary: `เด็กใหม่ที่ย้ายมาห้องคุณชื่อ ${c.name} สอบได้ที่หนึ่งตั้งแต่เทอมแรก แล้วหันมามองคุณ "นายคือคนที่ฉันต้องชนะ"`,
        murim: `ที่ลานฝึกของหมู่บ้าน ${c.name} เด็กจากตระกูลข้างเคียงฟาดไม้ใส่คุณจนล้ม "ลุกขึ้นมา! ข้าจะชนะเจ้าทุกวัน"`,
        court: `ในงานเลี้ยงน้ำชาของเด็กๆ ตระกูลขุนนาง ${c.name} เทชาใส่ชุดคุณ "อุ๊ย มือลื่น" — แล้วยิ้มอย่างไม่สำนึกผิดเลยสักนิด`,
      }),
    choices: [
      {
        label: "ท้ากลับทันที",
        odds: (l) => winOdds(l, 0.1),
        run: (l, c, ok) => {
          settle(l, ok);
          return ok ? good(`คุณเอาชนะ${c.name}ได้ต่อหน้าทุกคน — ตั้งแต่วันนั้น ${c.name}ไม่เคยละสายตาไปจากคุณอีกเลย`) : bad(`คุณแพ้${c.name}ต่อหน้าทุกคน — แต่คุณสาบานว่าจะไม่แพ้อีก`);
        },
      },
      {
        label: "ยื่นมือไปขอเป็นเพื่อน",
        run: (l, c) => {
          const p = nemesisOf(l);
          if (p) p.bond = 45;
          return meh(`${c.name}ปัดมือคุณทิ้ง "ใครอยากเป็นเพื่อนกับนาย" …แต่หูแดงไปหมด`);
        },
      },
      {
        label: "ไม่สนใจ",
        run: (_l, c) => meh(`คุณเดินผ่านไปเฉยๆ ${c.name}กำหมัดแน่น — ไม่มีอะไรทำให้คู่ปรับโกรธได้เท่าการถูกเมิน`),
      },
    ],
  },
  {
    id: "nemesis.clash",
    minAge: 10,
    maxAge: 75,
    maxTimes: 0,
    weight: (l) => (nemesisOf(l) && stage(l) !== "friend" && l.age - lastClash(l) >= 3 ? 14 : 0),
    title: "ปะทะคู่ปรับ",
    prepare: (l) => ({ name: shortName(nemesisOf(l)!) }),
    text: (l, c) => {
      if (l.age < 18 && !l.power)
        return W(l, {
          hunter: `ผลสอบกลางภาคประกาศแล้ว ชื่อคุณกับ${c.name}อยู่ติดกันบนบอร์ด — คะแนนห่างกันไม่ถึงสามแต้ม รอบนี้ใครจะได้ที่หนึ่ง?`,
          tower: `ผลสอบกลางภาคประกาศแล้ว ชื่อคุณกับ${c.name}อยู่ติดกันบนบอร์ด — คะแนนห่างกันไม่ถึงสามแต้ม รอบนี้ใครจะได้ที่หนึ่ง?`,
          apocalypse: `ผลสอบกลางภาคประกาศแล้ว ชื่อคุณกับ${c.name}อยู่ติดกันบนบอร์ด — คะแนนห่างกันไม่ถึงสามแต้ม รอบนี้ใครจะได้ที่หนึ่ง?`,
          ordinary: `ผลสอบกลางภาคประกาศแล้ว ชื่อคุณกับ${c.name}อยู่ติดกันบนบอร์ด — คะแนนห่างกันไม่ถึงสามแต้ม รอบนี้ใครจะได้ที่หนึ่ง?`,
          murim: `การประลองประจำปีของเด็กในหมู่บ้าน คู่สุดท้ายคือคุณกับ${c.name}เหมือนทุกปี`,
          court: `การแข่งขันขี่ม้าของบุตรหลานขุนนาง ม้าของคุณกับ${c.name}วิ่งคู่กันมาถึงโค้งสุดท้าย`,
        });
      return W(l, {
        hunter: `${c.name}ยืนขวางคุณหน้าทางเข้า Gate "แบ่งกันคนละครึ่ง? ไม่มีทาง ใครปราบบอสได้ก่อนคนนั้นเอาไปหมด"`,
        tower: `${c.name}ยืนรออยู่หน้าประตูบททดสอบ "ชั้นนี้ผ่านได้แค่ทีมเดียว — มาตัดสินกันตรงนี้"`,
        apocalypse: `${c.name}ยืนรออยู่หน้าประตูฉากภารกิจ "รางวัลมีแค่ชิ้นเดียว — คนที่รอดออกไปคือคนที่ได้"`,
        ordinary: `${c.name}ยืนรออยู่บนเวทีเดียวกัน — รางวัลมีชิ้นเดียว และทั้งประเทศกำลังดูอยู่`,
        murim: `${c.name}ปรากฏตัวบนหลังคาโรงเตี๊ยม ชักกระบี่ออกมาครึ่งฝัก "หลายปีแล้วนะ มาดูกันว่าเจ้าก้าวหน้าไปแค่ไหน"`,
        court: `ในงานเลี้ยงของจักรพรรดิ ${c.name}โยนถุงมือลงตรงหน้าคุณต่อหน้าขุนนางนับร้อย — คำท้าดวลที่ปฏิเสธไม่ได้`,
      });
    },
    choices: [
      {
        label: "สู้เต็มที่",
        tone: "danger",
        odds: (l) => winOdds(l) + Number(l.flags.skillBoost ?? 0),
        run: (l, c, ok) => {
          settle(l, ok);
          const p = nemesisOf(l);
          if (ok) {
            addFame(l, 3);
            addStat(l, "happiness", 6);
            gainExp(l, 300);
            if (p) p.bond = clamp(p.bond + 6, 0, 100);
            return good(`คุณชนะ${c.name}! สถิติตอนนี้ ${score(l) >= 0 ? `คุณนำอยู่ ${score(l)}` : `คุณยังตามอยู่ ${-score(l)}`} — ${c.name}ยิ้มทั้งที่เลือดออกปาก "ครั้งหน้าไม่ใช่แบบนี้แน่"`);
          }
          addStat(l, "happiness", -5);
          if (p) p.bond = clamp(p.bond + 3, 0, 100); // แพ้ก็ได้ความนับถือ
          if (l.power) addStat(l, "health", -randInt(l, 3, 8));
          return bad(`คุณแพ้${c.name}อีกครั้ง — แต่คุณเห็นแล้วว่าช่องว่างระหว่างคุณกับเขาแคบลงทุกปี`);
        },
      },
      {
        label: "ยอมให้ครั้งนี้ แล้วเลี้ยงข้าวกัน",
        run: (l, c) => {
          const p = nemesisOf(l);
          if (p) p.bond = clamp(p.bond + randInt(l, 10, 16), 0, 100);
          l.flags.nemLast = l.age;
          return meh(`${c.name}งงไปพักหนึ่ง แล้วนั่งลงกินข้าวด้วยแบบเขินๆ — พวกคุณคุยกันนานกว่าที่เคยสู้กันเสียอีก`);
        },
      },
    ],
  },
  {
    id: "nemesis.crossroads",
    minAge: 20,
    maxAge: 50,
    weight: (l) => (nemesisOf(l) && stage(l) === "rival" && l.age - lastClash(l) >= 2 ? 10 : 0),
    title: "ทางแยกของคู่ปรับ",
    prepare: (l) => ({ name: shortName(nemesisOf(l)!) }),
    text: (l, c) =>
      nemesisOf(l)!.bond >= 50
        ? `${c.name}มาหาคุณกลางดึก ตัวเปียกฝน "ฉันถูกไล่ออกจากทุกที่… คนเดียวที่ฉันนึกออกคือนาย"`
        : `ข่าวลือแพร่ไปทั่ว — ${c.name}ร่วมมือกับคนที่อยากเห็นคุณล่มสลาย และกำลังรวบรวมคนอยู่`,
    choices: [
      {
        label: "ยื่นมือให้",
        show: (l) => nemesisOf(l)!.bond >= 50,
        run: (l, c) => {
          const p = nemesisOf(l)!;
          l.flags.nemesisStage = "friend";
          p.relation = "ally";
          p.bond = 80;
          addStat(l, "happiness", 10);
          markTurn(l);
          return { text: `🤝 คู่ปรับที่สู้กันมาทั้งชีวิตกลายเป็นเพื่อนร่วมทีม — ${c.name}ไม่เคยพูดคำว่าขอบคุณ แต่ไม่เคยทิ้งคุณอีกเลย`, kind: "milestone" };
        },
      },
      {
        label: "ไปเผชิญหน้าให้รู้เรื่อง",
        show: (l) => nemesisOf(l)!.bond < 50,
        skill: ["social"],
        check: { stat: "smarts", dc: 55 },
        run: (l, c, ok) => {
          const p = nemesisOf(l)!;
          if (ok) {
            p.bond = 60;
            return good(`ความจริงคือ${c.name}ถูกขู่ให้ทำ คุณช่วยเขาออกมาได้ — ความแค้นระหว่างคุณเบาลงมาก`);
          }
          l.flags.nemesisStage = "enemy";
          p.bond = 0;
          return bad(`${c.name}มองคุณด้วยสายตาที่ไม่เหลือความเป็นคู่แข่งแล้ว — มีแต่ความเกลียด "วันหนึ่งฉันจะฆ่านาย"`);
        },
      },
      {
        label: "ตัดขาด",
        run: (l, c) => {
          l.flags.nemesisStage = "enemy";
          nemesisOf(l)!.bond = 5;
          return bad(`คุณปิดประตูใส่${c.name} — จากคู่ปรับ กลายเป็นศัตรู`);
        },
      },
    ],
  },
  {
    id: "nemesis.regressor",
    minAge: 18,
    maxAge: 40,
    weight: (l) => (nemesisOf(l) && l.flags.nemRegressor ? 12 : 0),
    title: "ผู้ย้อนเวลาอีกคน",
    system: true,
    prepare: (l) => ({ name: shortName(nemesisOf(l)!) }),
    text: (l, c) =>
      `${c.name}พูดถึงเหตุการณ์ที่ยังไม่เกิดขึ้นด้วยน้ำเสียงเรียบเฉย แล้วมองหน้าคุณ "${(l.regressions ?? 0) > 0 ? "นายก็จำได้ใช่ไหม… ชาติก่อนน่ะ" : "ทำไมนายถึงไม่ได้ตายตั้งแต่ปีนั้นล่ะ? ในชาติก่อน นายตายไปแล้วนะ"}"`,
    choices: [
      {
        label: "ร่วมมือ แลกความรู้อนาคตกัน",
        run: (l, c) => {
          const p = nemesisOf(l)!;
          p.bond = clamp(p.bond + 25, 0, 100);
          addStat(l, "luck", 8);
          addMoney(l, Math.round(Math.max(200_000, l.money * 0.2)));
          l.flags.nemesisStage = "friend";
          markTurn(l);
          return { text: `ผู้ย้อนเวลาสองคนรวมกัน — ${c.name}บอกจังหวะลงทุนที่คุณไม่เคยรู้ แลกกับสิ่งที่คุณจำได้ (โชค +8)`, kind: "milestone" };
        },
      },
      {
        label: "แข่งกันเปลี่ยนอนาคต",
        tone: "danger",
        odds: (l) => winOdds(l, 0.05) + Number(l.flags.skillBoost ?? 0),
        run: (l, c, ok) => {
          settle(l, ok);
          l.flags.nemesisStage = "enemy";
          if (ok) {
            if (l.power) luckyRankUp(l, `คุณแย่งวาสนาที่${c.name}หมายตาไว้ได้ก่อน`);
            else addStat(l, "luck", 5);
            return good(`คุณชิงวาสนาที่${c.name}จำได้ไปก่อน — ${c.name}รู้แล้วว่าอนาคตไม่ใช่ของเขาคนเดียว`);
          }
          addMoney(l, -Math.round(Math.max(0, l.money) * 0.25));
          return bad(`${c.name}เร็วกว่าคุณหนึ่งก้าวเสมอ — เขาจำอนาคตได้ละเอียดกว่าคุณ`);
        },
      },
    ],
  },
  {
    id: "nemesis.final",
    minAge: 28,
    maxAge: 80,
    weight: (l) => (nemesisOf(l) && stage(l) === "enemy" && l.age - lastClash(l) >= 2 ? 14 : 0),
    title: "การต่อสู้ครั้งสุดท้าย",
    prepare: (l) => ({ name: shortName(nemesisOf(l)!) }),
    text: (l, c) =>
      W(l, {
        hunter: `${c.name}ทำสัญญากับบางสิ่งใน Gate แดง ร่างกายเขาไม่ใช่มนุษย์อีกต่อไป "ทั้งชีวิตฉันอยู่ใต้เงานาย… วันนี้มันจะจบ"`,
        tower: `${c.name}ทำสัญญากับดวงดาวต้องห้าม พลังของเขาบิดเบี้ยวจนผู้ดูแลชั้นยังต้องถอย "ฉันจะเป็นคนเดียวที่ได้ขึ้นยอดหอคอย"`,
        apocalypse: `${c.name}ทำสัญญากับดวงดาวที่ทำให้โลกพัง พลังของเขาบิดเบี้ยวจนไม่เหลือความเป็นคน "ในฉากสุดท้าย มีผู้รอดได้คนเดียว"`,
        ordinary: `${c.name}ใช้ทุกอย่างทั้งเงินและอำนาจเพื่อทำลายคุณ "ทั้งชีวิต ฉันแพ้นายมาตลอด… ครั้งนี้ไม่"`,
        murim: `บนยอดเขาที่หิมะตกหนัก ${c.name}รออยู่พร้อมกระบี่ที่ชุบพิษ "ใต้หล้ามีที่ว่างให้ยอดฝีมือแค่คนเดียว"`,
        court: `${c.name}ยึดคฤหาสน์ของคุณกลางดึกพร้อมทหารรับจ้าง ไฟลุกท่วมสวนกุหลาบ "คืนนี้ไม่มีใครมาช่วยเธอหรอก"`,
      }),
    choices: [
      {
        label: "สู้ให้จบ",
        tone: "danger",
        odds: (l) => winOdds(l, 0.05) + Number(l.flags.skillBoost ?? 0),
        survival: (l) => clamp(winOdds(l, 0.35) + Number(l.flags.skillBoost ?? 0), 0.1, 0.97),
        run: (l, c, ok) => {
          const p = nemesisOf(l)!;
          if (ok) {
            p.alive = false;
            l.flags.nemesisBeaten = true;
            addFame(l, 15);
            gainExp(l, 1500);
            markTurn(l);
            return { text: `คุณยืนอยู่เหนือร่างของ${c.name} คู่ปรับที่อยู่กับคุณมาทั้งชีวิต — ชัยชนะที่ไม่รู้สึกเหมือนชัยชนะเลย`, kind: "milestone" };
          }
          if (!chance(l, clamp(winOdds(l, 0.35) + Number(l.flags.skillBoost ?? 0), 0.1, 0.97))) {
            kill(l, `ถูก${c.name} คู่ปรับตลอดกาล สังหาร`);
            return bad(`${c.name}ยืนมองคุณล้มลง แล้วหัวเราะทั้งน้ำตา`);
          }
          settle(l, false);
          addStat(l, "health", -25);
          return bad(`คุณรอดมาได้อย่างหวุดหวิด — แต่${c.name}หายไปในความมืด และจะกลับมาอีก`);
        },
      },
      {
        label: "พยายามเกลี้ยกล่อม",
        check: { stat: "happiness", dc: 70 },
        run: (l, c, ok) => {
          const p = nemesisOf(l)!;
          if (ok) {
            l.flags.nemesisStage = "friend";
            p.relation = "ally";
            p.bond = 70;
            markTurn(l);
            return { text: `คุณวางอาวุธลงก่อน แล้วพูดถึงวันแรกที่เจอกัน… ${c.name}ทรุดลงร้องไห้ — สงครามระหว่างคุณจบลงที่ตรงนั้น`, kind: "milestone" };
          }
          addStat(l, "health", -20);
          if (l.stats.health <= 0) {
            kill(l, `ถูก${c.name}แทงขณะพยายามเจรจา`);
            return bad("ความใจดีครั้งสุดท้าย…");
          }
          l.flags.nemLast = l.age;
          return bad(`${c.name}ไม่ฟังอะไรอีกแล้ว คุณหนีออกมาพร้อมแผลฉกรรจ์`);
        },
      },
    ],
  },
  {
    id: "nemesis.friend_help",
    minAge: 20,
    maxAge: 80,
    maxTimes: 3,
    weight: (l) => (nemesisOf(l) && stage(l) === "friend" ? 5 : 0),
    prepare: (l) => ({ name: shortName(nemesisOf(l)!) }),
    text: (l, c) =>
      pick(l, [
        `${c.name}โผล่มาช่วยตอนคุณกำลังเพลี่ยงพล้ำ "อย่าเข้าใจผิด คนที่จะชนะนายได้ต้องเป็นฉันคนเดียว"`,
        `${c.name}ส่งข้อมูลลับมาให้โดยไม่บอกว่าได้มายังไง — ท้ายจดหมายเขียนว่า "อย่าตายก่อนฉันล่ะ"`,
        `${c.name}กับคุณซ้อมด้วยกันทั้งคืนเหมือนสมัยเด็ก คราวนี้ไม่มีใครนับคะแนน`,
      ]),
    auto: (l) => {
      if (l.power) gainExp(l, 400);
      else addStat(l, "smarts", 2);
      addStat(l, "happiness", 4);
      return "good";
    },
  },
];
