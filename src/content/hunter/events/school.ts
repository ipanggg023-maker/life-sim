import type { GameEvent, Outcome } from "../../../engine/events";
import { enrollUniversity, gradeToGpa } from "../../../engine/game";
import { randInt } from "../../../engine/rng";
import { addFame, addMoney, addStat, clamp, createPerson, hasTalent, people, shortName } from "../../../engine/util";
import { FACULTIES } from "../careers";
import type { Faculty, Life } from "../../../engine/types";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const inSchool = (l: Life) => ["primary", "secondary", "high"].includes(l.education.stage);
const inUni = (l: Life) => l.education.stage === "university";

function addGrade(l: Life, d: number) {
  l.education.grade = clamp(l.education.grade + d, 0, 100);
}

/** โอกาสสอบติดคณะ: สติปัญญา + เกรด */
const facultyBonus = (l: Life) => (l.education.grade - 50) / 150;

function tcasChoice(f: (typeof FACULTIES)[number]) {
  return {
    label: `สอบเข้าคณะ${f.name}`,
    check: { stat: "smarts" as const, dc: f.dc, bonus: facultyBonus },
    run: (l: Life, _c: unknown, ok: boolean): Outcome => {
      if (ok) {
        enrollUniversity(l, f.id as Faculty);
        addStat(l, "happiness", 12);
        return { text: `🎉 คุณสอบติดคณะ${f.name}! (${f.years} ปี)${l.wealth === "poor" ? " ทุนกู้ยืม กยศ. อนุมัติแล้ว" : ""}`, kind: "milestone" };
      }
      addStat(l, "happiness", -12);
      l.flags.tcasFailed = Number(l.flags.tcasFailed ?? 0) + 1;
      return bad(`คุณสอบไม่ติดคณะ${f.name} ...ปีหน้าค่อยว่ากันใหม่`);
    },
  };
}

export const SCHOOL_EVENTS: GameEvent[] = [
  // ── เหตุการณ์บังคับ: จบ ม.6 ──
  {
    id: "school.after_high",
    minAge: 18,
    maxAge: 30,
    forced: true,
    maxTimes: 0,
    when: (l) =>
      l.education.highSchoolDone && !l.education.degree && !inUni(l) && !l.flags.skipUni &&
      Number(l.flags.tcasFailed ?? 0) < 3 && (l.age === 18 || !!l.flags.tcasFailed),
    title: "ทางแยกของชีวิต",
    text: (l) =>
      `${l.flags.tcasFailed ? "อีกปีแล้วที่ต้องสอบ TCAS" : "คุณจบ ม.6 แล้ว"} เกรดเฉลี่ย ${gradeToGpa(l.education.grade)} จะเอายังไงต่อ?`,
    choices: [
      ...FACULTIES.map(tcasChoice),
      {
        label: "ไม่เรียนต่อ ออกไปหางานทำเลย",
        run: (l) => { l.flags.skipUni = true; return meh("คุณตัดสินใจเข้าสู่โลกการทำงานด้วยวุฒิ ม.6"); },
      },
    ],
  },
  // ── จับใบดำใบแดง ──
  {
    id: "school.draft",
    minAge: 21,
    maxAge: 21,
    forced: true,
    when: (l) => l.gender === "m" && !l.flags.rotc,
    title: "วันเกณฑ์ทหาร",
    text: () => "วันนี้คุณต้องไปเกณฑ์ทหาร คนเต็มหอประชุม เสียงเชียร์ดังทุกครั้งที่มีคนจับได้ใบดำ",
    choices: [
      {
        label: "จับใบดำใบแดง",
        check: { stat: "luck", dc: 35 },
        run: (l, _c, ok) => {
          if (ok) { addStat(l, "happiness", 10); return good("⚫ ใบดำ! คุณกระโดดกอดคนแปลกหน้าข้างๆ"); }
          l.flags.soldier = true;
          addStat(l, "health", 10); addStat(l, "happiness", -10);
          return bad("🔴 ใบแดง... คุณต้องเป็นทหารเกณฑ์ 2 ปี ร่างกายแข็งแรงขึ้นเยอะ แต่ใจห่อเหี่ยว");
        },
      },
      {
        label: "สมัครใจเป็นทหาร (ลดเหลือ 1 ปี)",
        run: (l) => { l.flags.soldier = true; addStat(l, "health", 8); addStat(l, "happiness", -3); return meh("คุณใส่ชุดพรางทันที ญาติๆ ภูมิใจกันใหญ่"); },
      },
    ],
  },
  {
    id: "school.homework",
    minAge: 7,
    maxAge: 17,
    weight: (l) => (inSchool(l) ? 10 : 0),
    maxTimes: 2,
    text: () => "พรุ่งนี้ต้องส่งรายงานกลุ่ม แต่เพื่อนในกลุ่มหายเงียบกันหมด",
    choices: [
      { label: "ทำคนเดียวทั้งคืน", run: (l) => { addGrade(l, 6); addStat(l, "health", -2); return good("งานออกมาดีมาก ครูให้คะแนนเต็ม (แต่เพื่อนได้ด้วย)"); } },
      { label: "ใส่ชื่อแค่ตัวเอง", run: (l) => { addGrade(l, 3); addStat(l, "happiness", 3); return meh("เพื่อนโกรธ แต่คุณไม่สน"); } },
      { label: "ช่างมัน ไม่ทำแล้ว", run: (l) => { addGrade(l, -8); return bad("ทั้งกลุ่มได้ศูนย์ ครูเรียกผู้ปกครอง"); } },
    ],
  },
  {
    id: "school.cheat",
    minAge: 9,
    maxAge: 22,
    weight: (l) => (inSchool(l) || inUni(l) ? 8 : 0),
    text: () => "ระหว่างสอบ เพื่อนข้างๆ ยื่นโพยมาให้ใต้โต๊ะ",
    choices: [
      {
        label: "ลอกเลย",
        check: { stat: "luck", dc: 45 },
        run: (l, _c, ok) => {
          if (ok) { addGrade(l, 10); return good("คุณได้คะแนนสูงสุดในห้อง... ความรู้สึกผิดตามมาทีหลัง"); }
          addGrade(l, -15); addStat(l, "happiness", -8);
          return bad("อาจารย์คุมสอบยืนอยู่ข้างหลังพอดี คุณได้ศูนย์และโดนบันทึกพฤติกรรม");
        },
      },
      { label: "ไม่รับ ทำเอง", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => {
        addGrade(l, ok ? 5 : -2);
        return ok ? good("คุณทำได้ด้วยตัวเอง ภูมิใจสุดๆ") : meh("คะแนนกลางๆ แต่ใจสะอาด");
      } },
    ],
  },
  {
    id: "school.bully",
    minAge: 8,
    maxAge: 16,
    weight: (l) => (inSchool(l) ? (l.stats.looks < 40 || l.wealth === "poor" ? 12 : 6) : 0),
    maxTimes: 2,
    prepare: (l) => {
      const p = createPerson(l, "rival", { age: l.age + 1, bond: 10 });
      return { id: p.id, name: shortName(p) };
    },
    text: (_l, c) => `${c.name} รุ่นพี่ตัวโตกับแก๊งมาไถเงินคุณหลังโรงเรียน`,
    choices: [
      {
        label: "สู้!",
        tone: "danger",
        check: { stat: "health", dc: 60 },
        run: (l, c, ok) => {
          if (ok) {
            addStat(l, "happiness", 10); addFame(l, 3);
            return good(`คุณต่อย${c.name}ร่วงในหมัดเดียว ทั้งโรงเรียนลือกันว่าคุณซ่อนพลังไว้`);
          }
          addStat(l, "health", -10); addStat(l, "happiness", -8);
          return bad("คุณโดนรุมจนตาเขียว แต่อย่างน้อยก็ไม่ยอมให้เงิน");
        },
      },
      { label: "ให้เงินไป", run: (l) => { addMoney(l, -Math.min(200, Math.max(0, l.money))); addStat(l, "happiness", -6); return bad("พวกมันหัวเราะใส่แล้วบอกว่า \"พรุ่งนี้เจอกันใหม่\""); } },
      { label: "วิ่งไปฟ้องครู", check: { stat: "smarts", dc: 45 }, run: (l, c, ok) => {
        if (ok) return good(`ครูพักการเรียน${c.name}หนึ่งสัปดาห์`);
        addStat(l, "happiness", -5); return bad("ครูไม่เชื่อ และพวกมันก็รู้ว่าคุณฟ้อง");
      } },
    ],
  },
  {
    id: "school.new_friend",
    minAge: 6,
    maxAge: 22,
    weight: (l) => (people(l, "friend").length < 4 ? 14 : 4),
    maxTimes: 4,
    prepare: (l) => {
      const p = createPerson(l, "friend", { age: l.age + randInt(l, -1, 1), bond: randInt(l, 45, 70) });
      return { name: shortName(p) };
    },
    text: (_l, c) => `คุณได้เพื่อนใหม่ชื่อ${c.name} คุยกันถูกคอตั้งแต่วันแรก`,
    auto: (l) => { addStat(l, "happiness", 4); return "good"; },
  },
  {
    id: "school.crush",
    minAge: 13,
    maxAge: 22,
    weight: (l) => (people(l, "partner").length ? 0 : 10),
    maxTimes: 2,
    prepare: (l) => {
      const g = l.gender === "m" ? "f" : "m";
      return { g, name: g === "m" ? "รุ่นพี่นักบาส" : "เพื่อนต่างห้องที่ยิ้มสวย" };
    },
    text: (_l, c) => `คุณแอบชอบ${c.name}มานาน หัวใจเต้นแรงทุกครั้งที่เดินสวนกัน`,
    choices: [
      {
        label: "สารภาพรัก",
        check: { stat: "looks", dc: 55, bonus: (l) => (hasTalent(l, "charm") ? 0.2 : 0) },
        run: (l, c, ok) => {
          if (ok) {
            const p = createPerson(l, "partner", { gender: c.g as "m" | "f", age: l.age, bond: 75 });
            addStat(l, "happiness", 15);
            return good(`💕 ${shortName(p)}ก็ชอบคุณเหมือนกัน! คุณมีแฟนคนแรกแล้ว`);
          }
          addStat(l, "happiness", -12);
          return bad("\"ขอโทษนะ เราเห็นเธอเป็นแค่เพื่อน\" ...คุณฟังเพลงอกหักวนทั้งเดือน");
        },
      },
      { label: "เขียนจดหมายไม่ลงชื่อ", run: (l) => { addStat(l, "happiness", 3); return meh("อีกฝ่ายอ่านแล้วยิ้ม แต่ไม่รู้ว่าเป็นคุณ"); } },
      { label: "เก็บไว้ในใจ", run: () => meh("บางความรู้สึกก็สวยงามที่สุดตอนที่ไม่ได้พูดออกไป") },
    ],
  },
  {
    id: "school.talent_show",
    minAge: 8,
    maxAge: 17,
    weight: (l) => (inSchool(l) ? 6 : 0),
    text: () => "โรงเรียนจัดประกวดร้องเพลง ครูประจำชั้นส่งชื่อคุณไปโดยไม่ถาม",
    choices: [
      {
        label: "ขึ้นเวทีเต็มที่",
        check: { stat: "looks", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 6); addStat(l, "happiness", 10); return good("คุณชนะเลิศ! คลิปถูกแชร์ในเพจโรงเรียนหลายพันครั้ง"); }
          addStat(l, "happiness", -8); addFame(l, -2);
          return bad("เสียงคุณเพี้ยนกลางท่อนฮุก คลิปถูกแชร์ในเพจโรงเรียนหลายพันครั้ง");
        },
      },
      { label: "แกล้งป่วย", run: () => meh("คุณรอดตัว แต่ครูรู้ทัน") },
    ],
  },
  {
    id: "school.sports_day",
    minAge: 7,
    maxAge: 17,
    weight: (l) => (inSchool(l) ? 6 : 0),
    text: () => "กีฬาสี! สีของคุณขาดนักวิ่งผลัดหนึ่งคน",
    choices: [
      {
        label: "อาสาวิ่งไม้สุดท้าย",
        check: { stat: "health", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { addStat(l, "happiness", 10); addFame(l, 2); return good("คุณแซงเข้าเส้นชัยแบบเฉือนกันแค่ปลายจมูก ทั้งสแตนด์ร้องลั่น"); }
          addStat(l, "health", -3); return bad("คุณสะดุดไม้ผลัดตัวเองล้มกลางลู่");
        },
      },
      { label: "อยู่กองเชียร์", run: (l) => { addStat(l, "happiness", 4); return meh("คุณตะโกนเชียร์จนเสียงแหบ"); } },
    ],
  },
  {
    id: "school.teacher_praise",
    minAge: 7,
    maxAge: 17,
    weight: (l) => (inSchool(l) && l.education.grade > 75 ? 8 : 0),
    maxTimes: 2,
    text: () => "ครูประกาศชื่อคุณหน้าชั้นเพราะได้คะแนนสอบสูงสุดในสายชั้น",
    auto: (l) => { addStat(l, "happiness", 6); return "good"; },
  },
  {
    id: "school.game_addict",
    minAge: 10,
    maxAge: 20,
    weight: 8,
    text: () => "เกม MMORPG ใหม่ \"Gate Breaker Online\" เปิดตัว เพื่อนทั้งห้องเล่นกันหมด",
    choices: [
      { label: "เล่นทั้งคืนทุกคืน", run: (l) => { addGrade(l, -12); addStat(l, "happiness", 8); addStat(l, "health", -4); l.flags.gamer = true; return meh("คุณขึ้นอันดับ 1 ของเซิร์ฟเวอร์... และอันดับสุดท้ายของห้อง"); } },
      { label: "เล่นแค่วันหยุด", run: (l) => { addStat(l, "happiness", 4); return good("คุณบาลานซ์ได้ดี"); } },
      { label: "ไม่เล่น อ่านหนังสือดีกว่า", run: (l) => { addGrade(l, 5); addStat(l, "happiness", -2); return meh("เพื่อนคุยเรื่องเกมกันทั้งวัน คุณคุยไม่รู้เรื่อง"); } },
    ],
  },
  {
    id: "school.sneak_out",
    minAge: 13,
    maxAge: 17,
    weight: 7,
    text: () => "เพื่อนชวนโดดเรียนไปเที่ยวสยาม",
    choices: [
      {
        label: "ไปด้วย",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { addStat(l, "happiness", 8); return good("วันที่สนุกที่สุดของปี และไม่มีใครจับได้"); }
          addGrade(l, -6); addStat(l, "happiness", -4);
          return bad("ครูฝ่ายปกครองเดินห้างอยู่พอดี...");
        },
      },
      { label: "ไม่ไป", run: (l) => { addGrade(l, 2); return meh("คุณนั่งเรียนเลขคาบบ่ายอย่างเหงาๆ"); } },
    ],
  },
  {
    id: "school.hunter_visit",
    world: "hunter",
    minAge: 10,
    maxAge: 17,
    weight: 8,
    title: "แขกพิเศษ",
    text: () => "Hunter แรงก์ C ที่เป็นศิษย์เก่ามาบรรยายในหอประชุม \"การตื่นพลังมักเกิดช่วงอายุ 18–20 ปี และไม่มีใครรู้ว่าใครจะได้\"",
    choices: [
      { label: "ยกมือถามว่าตอนตื่นพลังรู้สึกยังไง", run: (l) => { l.flags.awakeningLore = true; return meh("\"เหมือนมีหน้าต่างสีฟ้าเด้งขึ้นมาในหัว... แล้วโลกก็ไม่เหมือนเดิมอีกเลย\""); } },
      { label: "ขอลายเซ็น", run: (l) => { addStat(l, "happiness", 5); return good("คุณได้ลายเซ็นบนสมุดการบ้าน"); } },
      { label: "หลับ", run: () => meh("คุณตื่นมาตอนทุกคนปรบมือ") },
    ],
  },
  {
    id: "school.olympiad",
    minAge: 12,
    maxAge: 17,
    weight: (l) => (inSchool(l) && l.stats.smarts > 65 ? 10 : 0),
    text: () => "คุณถูกคัดเลือกไปแข่งโอลิมปิกวิชาการระดับประเทศ",
    choices: [
      {
        label: "ทุ่มสุดตัว",
        check: { stat: "smarts", dc: 78 },
        run: (l, _c, ok) => {
          if (ok) { addGrade(l, 15); addFame(l, 8); addStat(l, "happiness", 10); l.flags.olympiad = true; return good("🥇 คุณได้เหรียญทอง! มหาวิทยาลัยดังหลายแห่งเริ่มจับตาคุณ"); }
          addStat(l, "happiness", -4); return meh("คุณได้เกียรติบัตรเข้าร่วม ประสบการณ์ล้ำค่า");
        },
      },
    ],
  },
  {
    id: "school.acne",
    minAge: 13,
    maxAge: 17,
    weight: 6,
    text: () => "สิวเม็ดใหญ่ขึ้นกลางหน้าผากวันถ่ายรูปหมู่",
    choices: [
      { label: "บีบมัน!", run: (l) => { addStat(l, "looks", -3); return bad("มันกลายเป็นแผลเป็นเล็กๆ"); } },
      { label: "ปล่อยไว้", run: () => meh("รูปหมู่ปีนี้มีคุณกับสิวอยู่คู่กันตลอดกาล") },
    ],
  },
  {
    id: "school.tutoring",
    minAge: 14,
    maxAge: 17,
    weight: (l) => (inSchool(l) && l.wealth !== "poor" ? 8 : 0),
    text: () => "พ่อแม่ส่งคุณไปเรียนพิเศษที่สยามทุกเสาร์อาทิตย์",
    choices: [
      { label: "ตั้งใจเรียน", run: (l) => { addGrade(l, 10); addStat(l, "smarts", 2); addStat(l, "happiness", -3); return good("คุณทำโจทย์ที่เคยไม่เข้าใจได้แล้ว"); } },
      { label: "แอบไปเดินเล่นแทน", run: (l) => { addStat(l, "happiness", 6); return meh("ค่าเรียนพิเศษเทอมนี้กลายเป็นค่าชานมไข่มุก"); } },
    ],
  },
  // ── มหาวิทยาลัย ──
  {
    id: "uni.freshy",
    minAge: 18,
    maxAge: 21,
    weight: (l) => (inUni(l) ? 30 : 0),
    text: () => "กิจกรรมรับน้องเริ่มแล้ว รุ่นพี่สั่งให้วิ่งรอบสนามกลางแดด",
    choices: [
      { label: "ร่วมทุกกิจกรรม", run: (l) => { const p = createPerson(l, "friend", { age: l.age, bond: 65 }); addStat(l, "happiness", 5); return good(`คุณสนิทกับ${shortName(p)} เพื่อนร่วมรุ่นที่จะอยู่ด้วยกันไปอีกนาน`); } },
      { label: "ปฏิเสธ ไม่ใช่ยุคนี้แล้ว", check: { stat: "smarts", dc: 45 }, run: (l, _c, ok) => ok ? good("รุ่นพี่ยอมรับเหตุผล และยกเลิกการว้ากทั้งคณะ") : (addStat(l, "happiness", -4), bad("คุณกลายเป็นคนนอกของรุ่นไปพักหนึ่ง")) },
    ],
  },
  {
    id: "uni.thesis",
    minAge: 20,
    maxAge: 26,
    weight: (l) => (inUni(l) && (l.education.uniYearsLeft ?? 9) <= 1 ? 25 : 0),
    text: () => "โปรเจกต์จบใกล้ถึงเดดไลน์ อาจารย์ที่ปรึกษาตีกลับเป็นครั้งที่ห้า",
    choices: [
      { label: "อดหลับอดนอนแก้", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => {
        addStat(l, "health", -4);
        if (ok) { addGrade(l, 10); return good("อาจารย์เซ็นผ่าน! คุณร้องไห้หน้าห้องภาควิชา"); }
        addGrade(l, -5); return bad("แก้ครั้งที่หกก็ยังไม่ผ่าน...");
      } },
      { label: "จ้างรุ่นพี่ช่วย", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => {
        addMoney(l, -15000);
        if (ok) { addGrade(l, 8); return meh("งานผ่านไปได้ด้วยดี"); }
        addGrade(l, -20); return bad("อาจารย์จับได้ว่าไม่ใช่งานคุณ!");
      } },
    ],
  },
  {
    id: "uni.parttime",
    minAge: 18,
    maxAge: 24,
    weight: (l) => (inUni(l) && !l.job ? 8 : 0),
    text: () => "ร้านกาแฟหน้ามหาลัยรับสมัครพนักงานพาร์ตไทม์",
    choices: [
      { label: "สมัครเลย", run: (l) => { addMoney(l, 36000); addGrade(l, -4); addStat(l, "health", -2); return good("คุณได้เงินใช้ปีนี้ 36,000 บาท แต่ง่วงในคาบเช้าตลอด"); } },
      { label: "ไม่ดีกว่า โฟกัสเรียน", run: (l) => { addGrade(l, 3); return meh("คุณตั้งใจเรียนต่อไป"); } },
    ],
  },
  {
    id: "uni.ordain",
    minAge: 20,
    maxAge: 30,
    weight: (l) => (l.gender === "m" && !inUni(l) ? 7 : 0),
    text: () => "แม่อยากให้คุณบวชทดแทนคุณสักพรรษา",
    choices: [
      { label: "บวช", run: (l) => { addStat(l, "happiness", 8); addStat(l, "luck", 3); l.flags.ordained = true; for (const p of l.people) if (p.relation === "mother" || p.relation === "father") p.bond = Math.min(100, p.bond + 15); return good("แม่ร้องไห้ด้วยความปลื้ม ใจคุณสงบขึ้นอย่างประหลาด"); } },
      { label: "ขอไว้ก่อน", run: (l) => { for (const p of l.people) if (p.relation === "mother") p.bond = Math.max(0, p.bond - 8); return meh("แม่ไม่พูดอะไร แต่ดูผิดหวัง"); } },
    ],
  },
];
