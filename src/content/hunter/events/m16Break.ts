// M16 — Gate Break กลางเมือง: ปีที่ประตูแตก (สุ่มใน m16.ts) ทุกคนในเมืองต้องเลือกว่าจะทำอะไร
import type { Ctx, GameEvent } from "../../../engine/events";
import { pick, randInt, chance } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, money, people, shortName } from "../../../engine/util";
import { CORE_TIERS, addCores, addRep, coresOf, corePrice, guildLv, myGuild, sellCores, tierOf } from "../m16";
import { fightOdds, gateRewards, rankName, survivalOdds } from "../power";
import { awake, bad, big, good, hurt, lost, meh, rank, w } from "./m16kit";

const BR = (c: Ctx) => Number(c.br);
const breakNow = (l: Life) => l.flags.breakAge === l.age;
const breakRecent = (l: Life) => l.flags.breakAge !== undefined && l.age - Number(l.flags.breakAge) <= 1;
const guildHelp = (l: Life) => (myGuild(l) ? guildLv(l) * 0.04 : 0);

export const BREAK_EVENTS: GameEvent[] = [
  {
    id: "h16.break",
    minAge: 5,
    maxAge: 110,
    forced: true,
    maxTimes: 0,
    when: breakNow,
    title: "Gate Break!",
    prepare: (l) => ({
      br: l.power ? clamp(l.power.rank + randInt(l, -1, 1), 1, 8) : randInt(l, 2, 5),
      place: pick(l, ["สี่แยกอโศก", "ห้างใหญ่ย่านบางนา", "ตลาดนัดจตุจักร", "สถานีหัวลำโพง", "สะพานพระราม 8", "สนามกีฬาแห่งชาติ", "ท่าเรือคลองเตย"]),
      m: pick(l, ["ออร์กยักษ์ถือขวาน", "ฝูงก็อบลินนับพัน", "ไวเวิร์นหัวสีเลือด", "โกเลมลาวา", "ราชินีแมงมุม", "อัศวินศพม้าดำ"]),
    }),
    text: (l, c) =>
      `🚨 เสียงไซเรนดังทั่วเมือง — Gate แรงก์ ${rankName(BR(c))} ที่${c.place}ไม่มีใครเคลียร์ทันเวลา ประตูแตกออก! ${c.m}ทะลักออกมาบนถนน` +
      (l.power ? ` สมาคมส่งข้อความหา Hunter ทุกคนในรัศมีห้ากิโล: "ใครอยู่ใกล้ ช่วยด้วย"` : l.age < 13 ? " ครูตะโกนให้ทุกคนหมอบใต้โต๊ะ" : " โทรศัพท์ทุกเครื่องในถนนสั่นพร้อมกันด้วยข้อความเตือนภัย"),
    choices: [
      // ── ผู้ตื่นพลัง ──
      { label: "พุ่งเข้าไปสกัดมอนสเตอร์", show: awake, run: () => meh("คุณวิ่งสวนทางกับฝูงชนที่กำลังหนีตาย", "front") },
      { label: "ช่วยอพยพประชาชนก่อน", show: awake, run: () => meh("คุณกระโดดขึ้นหลังคารถเมล์แล้วตะโกนสั่งให้ทุกคนไปทางเดียวกัน", "evac") },
      { label: "ฉวยโอกาสเก็บคอร์จากซากมอนสเตอร์", show: awake, run: () => meh("ในขณะที่คนอื่นสู้ คุณเห็นซากมอนสเตอร์ที่ยังไม่มีใครแตะ…", "loot") },
      {
        label: "ปิดโทรศัพท์ แกล้งทำเป็นไม่เห็น",
        show: awake,
        run: (l) => { addFame(l, -6); addStat(l, "happiness", -8); l.flags.breakCoward = true; return bad("คุณนั่งดูข่าวอยู่ในห้อง รายชื่อผู้เสียชีวิตเลื่อนขึ้นเรื่อยๆ และมีใครบางคนโพสต์ว่าเห็นคุณอยู่แถวนั้น"); },
      },
      // ── คนธรรมดา ──
      {
        label: (l) => (l.age < 13 ? "หมอบใต้โต๊ะตามที่ซ้อมไว้" : "วิ่งตามเจ้าหน้าที่ไปหลุมหลบภัย"),
        show: (l) => !awake(l),
        run: (l) => { addStat(l, "happiness", -6); return meh(l.age < 13 ? "คุณกอดเข่าใต้โต๊ะสามชั่วโมง ได้ยินเสียงคำรามผ่านหน้าต่างไป แล้วก็เงียบ" : "หลุมหลบภัยอัดแน่นไปด้วยคนแปลกหน้า มีคุณป้าแบ่งขนมปังให้ทุกคน คุณรอดมาได้"); },
      },
      {
        label: "กลับไปช่วยคุณยายข้างบ้านที่เดินไม่ได้",
        show: (l) => !awake(l) && l.age >= 10,
        check: { stat: "health", dc: 55 },
        skill: ["escape", "heal"],
        run: (l, c, ok) => {
          if (ok) { addFame(l, 4); addStat(l, "happiness", 10); l.flags.breakSaver = true; return good("คุณแบกคุณยายลงบันไดหกชั้น เงาของ" + c.m + "พาดผ่านหัวไปพอดีตอนถึงชั้นล่าง คลิปจากกล้องวงจรปิดถูกแชร์ทั่วประเทศ"); }
          return bad("เศษกระจกร่วงลงมาตอนคุณลากคุณยายออกมา ทั้งสองคนรอด แต่คุณต้องเย็บแผลยี่สิบเข็ม" + hurt(l, 8, 18, `บาดเจ็บระหว่าง Gate Break ที่${c.place}`));
        },
      },
      {
        label: "ไลฟ์สดจากหน้าต่าง",
        show: (l) => !awake(l) && l.age >= 13,
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 6); addMoney(l, 30_000); return good("ไลฟ์ของคุณมีคนดูพร้อมกันสองล้านคน — คุณถ่ายติดตอน Hunter แรงก์ S ฟันมอนสเตอร์ขาดสองท่อนพอดี"); }
          return bad("มอนสเตอร์หันมามองแสงจากโทรศัพท์คุณ… หน้าต่างแตกกระจาย" + hurt(l, 10, 22, "ถูกมอนสเตอร์โจมตีระหว่างไลฟ์สด"));
        },
      },
    ],
    scenes: {
      front: {
        title: "แนวหน้า",
        text: (_l, c) => `${c.m}แรงก์ ${rankName(BR(c))} ยืนอยู่กลาง${c.place} รถยนต์พลิกคว่ำเกลื่อนถนน Hunter ที่มาถึงก่อนคุณนอนเจ็บอยู่สองคน`,
        choices: [
          {
            label: "ปะทะตรงๆ",
            tone: "danger",
            odds: (l, c) => fightOdds(l, BR(c), guildHelp(l)),
            survival: (l, c) => survivalOdds(l, BR(c), guildHelp(l) + 0.1),
            run: (l, c, ok) => {
              if (ok) {
                const r = gateRewards(l, BR(c), 1.2, true);
                const t = tierOf(BR(c));
                addCores(l, t, 2);
                addFame(l, BR(c) >= 5 ? 14 : 8);
                addRep(l, 10);
                l.flags.breakHero = Number(l.flags.breakHero ?? 0) + 1;
                return big(`💥 คุณล้ม${c.m}กลางถนน! เสียงปรบมือดังมาจากตึกทุกชั้น ${r} · ได้${CORE_TIERS[t].name} 2 ก้อน${myGuild(l) ? ` — สมาชิก「${myGuild(l)}」ช่วยกันกั้นแนวไว้ทั้งคืน` : ""}`);
              }
              return lost(l, BR(c), `เสียชีวิตขณะสกัด Gate Break ที่${c.place}`, `${c.m}ฟาดคุณกระเด็นทะลุกระจกร้านสะดวกซื้อ`, 15, 30);
            },
          },
          {
            label: "ถ่วงเวลาไว้จนกว่าทีมแรงก์ S จะมา",
            check: { stat: "health", dc: 50, bonus: (l, c) => (rank(l) - BR(c)) * 0.08 },
            run: (l, c, ok) => {
              if (ok) { addFame(l, 6); gateRewards(l, BR(c), 0.5, false); return good(`คุณวิ่งล่อ${c.m}วนรอบวงเวียนอยู่ยี่สิบนาที จนกองกำลังพิเศษมาถึง สมาคมยกย่องว่าคุณช่วยชีวิตคนได้หลายร้อย`); }
              return bad("แผนล่อของคุณได้ผลครึ่งเดียว มันไล่ตามคุณทันที่ปากซอย" + hurt(l, 10, 20, `บาดเจ็บสาหัสจาก Gate Break ที่${c.place}`));
            },
          },
          {
            label: "ลากคนเจ็บออกมาก่อน",
            run: (l) => { addFame(l, 5); addStat(l, "happiness", 6); l.flags.savedHunter = Number(l.flags.savedHunter ?? 0) + 2; return good("คุณลาก Hunter สองคนเข้าที่กำบังได้ทัน หนึ่งในนั้นจับมือคุณแน่น \"ฉันติดหนี้ชีวิตนายแล้ว\""); },
          },
        ],
      },
      evac: {
        title: "อพยพ",
        text: (_l, c) => `ฝูงชนหลายพันคนอัดกันอยู่ที่ทางลงสถานีใต้ดินใกล้${c.place} มีคนล้มทับกัน เสียงกรีดร้องกลบเสียงประกาศ`,
        choices: [
          {
            label: "ใช้พลังเปิดทางและคุมฝูงชน",
            check: { stat: "smarts", dc: 50, bonus: (l) => (l.power ? 0.1 : 0) },
            skill: ["escape", "social", "heal"],
            run: (l, c, ok) => {
              if (ok) { addFame(l, 9); addStat(l, "happiness", 12); addRep(l, 8); l.flags.breakSaver = true; return big(`คุณพาคนกว่าสามพันคนลงหลุมหลบภัยได้โดยไม่มีใครเหยียบกันตาย ข่าวค่ำเรียกคุณว่า "ประตูมนุษย์แห่ง${c.place}"`); }
              addStat(l, "happiness", -10);
              return bad("คุณช่วยได้หลายคน แต่ไม่ใช่ทุกคน… ภาพเด็กที่หลงพ่อแม่ยังติดตาคุณอยู่หลายคืน");
            },
          },
          {
            label: "อุ้มเด็กที่หลงกับพ่อแม่ไปส่ง",
            run: (l) => { addStat(l, "happiness", 8); addFame(l, 3); return good("คุณพาเด็กหญิงตัวเล็กไปเจอแม่ที่จุดรวมพล เธอให้สติกเกอร์รูปหมีกับคุณหนึ่งแผ่น คุณแปะไว้ที่ใบอนุญาต Hunter ตั้งแต่วันนั้น"); },
          },
        ],
      },
      loot: {
        title: "ซากมอนสเตอร์",
        text: (_l, c) => `ซากมอนสเตอร์สามตัวนอนเกลื่อนในซอยหลัง${c.place} คอร์ในอกยังเรืองแสงอยู่ ไม่มีกล้องวงจรปิด… น่าจะนะ`,
        choices: [
          {
            label: "ควักคอร์ทั้งหมดแล้วรีบหนี",
            check: { stat: "luck", dc: 50 },
            skill: ["stealth"],
            run: (l, c, ok) => {
              const t = tierOf(BR(c));
              if (ok) { addCores(l, t, 3); l.flags.breakLooter = true; return good(`คุณได้${CORE_TIERS[t].name} 3 ก้อนใส่กระเป๋าเป้ ไม่มีใครเห็น — ปีนี้ราคาคอร์กำลังพุ่ง`); }
              addCores(l, t, 1);
              addFame(l, -14);
              return bad(`โดรนของสถานีข่าวบินผ่านพอดี ภาพคุณกำลังควักคอร์ขณะที่คนอื่นสู้ตายขึ้นหน้าหนึ่ง "Hunter แร้ง" กลายเป็นฉายาของคุณ`);
            },
          },
          {
            label: "เก็บไว้ให้สมาคม แล้วกลับไปช่วยรบ",
            run: (l) => { addFame(l, 4); addRep(l, 4); return meh("คุณทำเครื่องหมายซากไว้ให้หน่วยเก็บกู้ แล้วหันหลังวิ่งกลับไปทางเสียงระเบิด", "front"); },
          },
        ],
      },
    },
  },
  {
    id: "h16.break_warning",
    minAge: 16,
    maxAge: 80,
    weight: (l) => w(awake(l) && !breakRecent(l), 4),
    maxTimes: 2,
    text: () => "เดินผ่านลานจอดรถใต้ห้าง ขนแขนคุณลุกชัน อากาศตรงเสาต้นที่สามบิดเบี้ยวเหมือนไอร้อน — มีมานารั่วออกมาจากตรงนั้น Gate ที่ยังไม่มีใครเห็นกำลังจะเปิด",
    choices: [
      { label: "แจ้งสมาคมทันที", run: (l) => { addFame(l, 3); addMoney(l, 50_000); return good("ทีมสำรวจมาถึงในยี่สิบนาที และพบ Gate ที่กำลังก่อตัว สมาคมจ่ายรางวัลแจ้งเบาะแสให้คุณ"); } },
      {
        label: "รอให้มันเปิด แล้วเข้าไปเคลียร์คนเดียว",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l)),
        survival: (l) => survivalOdds(l, rank(l), 0.1),
        run: (l, _c, ok) => {
          if (ok) { const r = gateRewards(l, rank(l), 1, true); addCores(l, tierOf(rank(l)), 1); return good(`ไม่มีใครรู้ว่าเคยมี Gate ตรงนี้ — ${r} และคอร์อีกหนึ่งก้อนที่ไม่ต้องแบ่งใคร`); }
          return lost(l, rank(l), "เข้า Gate เถื่อนคนเดียวแล้วไม่ได้ออกมา", "Gate นี้ไม่ใช่แรงก์ที่คุณคิด");
        },
      },
      { label: "ทำเป็นไม่เห็น", run: (l) => { l.flags.ignoredGate = true; return meh("คุณขับรถออกไป… สามเดือนต่อมามีข่าว Gate Break เล็กๆ ที่ห้างนั้น โชคดีไม่มีใครตาย"); } },
    ],
  },
  {
    id: "h16.break_kid_siren",
    minAge: 5,
    maxAge: 13,
    weight: (l) => w(breakRecent(l), 30),
    text: () => "หลังวัน Gate Break คุณสะดุ้งตื่นกลางดึกทุกครั้งที่ได้ยินเสียงรถพยาบาล แม่สังเกตว่าคุณไม่ยอมปิดไฟนอน",
    choices: [
      { label: "ไปนอนกับพ่อแม่", run: (l) => { addStat(l, "happiness", 4); return good("พ่อกรนดังมาก ดังจนเสียงไซเรนในหัวคุณเงียบไปเอง"); } },
      { label: "วาดรูป Hunter ที่ช่วยเมืองไว้แปะหัวเตียง", run: (l) => { l.flags.dreamHunter = true; addStat(l, "happiness", 6); return good("ถ้าเขาไม่กลัว คุณก็จะไม่กลัว"); } },
      { label: "เก็บไว้คนเดียว", run: (l) => { addStat(l, "happiness", -6); addStat(l, "smarts", 2); return meh("คุณเริ่มจำเส้นทางหนีไฟของทุกตึกที่เดินเข้าไป"); } },
    ],
  },
  {
    id: "h16.break_insurance",
    minAge: 22,
    maxAge: 90,
    weight: (l) => w(breakRecent(l) && !awake(l), 25),
    prepare: (l) => ({ amt: randInt(l, 3, 12) * 100_000 }),
    text: (l, c) => `บ้านคุณโดนหางมอนสเตอร์ฟาดผนังพังไปครึ่งหลัง ค่าซ่อมประมาณ ${money(l, Number(c.amt))} บริษัทประกันบอกว่า "Gate Break อยู่ในข้อยกเว้นเหตุสุดวิสัยค่ะ"`,
    choices: [
      {
        label: "อ่านกรมธรรม์ทุกบรรทัดแล้วสู้",
        check: { stat: "smarts", dc: 55 },
        skill: ["business", "study"],
        run: (l, c, ok) => (ok ? good("คุณเจอวงเล็บเล็กๆ ว่าข้อยกเว้นใช้กับ Gate แรงก์ S ขึ้นไปเท่านั้น ประกันจ่ายเต็มจำนวน") : (addMoney(l, -Number(c.amt)), bad("ทนายของบริษัทพูดเร็วกว่าคุณสามเท่า คุณจ่ายค่าซ่อมเอง"))),
      },
      { label: "จ่ายเอง ไม่อยากวุ่นวาย", run: (l, c) => { addMoney(l, -Number(c.amt)); return meh("ช่างซ่อมบอกว่าเดือนนี้คิวยาวสามเดือน ทั้งเมืองซ่อมบ้านพร้อมกัน"); } },
      { label: "รวมตัวผู้เสียหายฟ้องสมาคม Hunter", check: { stat: "looks", dc: 55 }, skill: ["social"], run: (l, c, ok) => (ok ? (addMoney(l, Number(c.amt)), addFame(l, 3), good("คดีกลุ่มของคุณชนะ สมาคมต้องตั้งกองทุนชดเชยผู้เสียหาย คุณได้เงินมากกว่าค่าซ่อม")) : (addMoney(l, -Number(c.amt)), meh("คดีเงียบหายไปในระบบ"))) },
    ],
  },
  {
    id: "h16.break_orphan",
    minAge: 28,
    maxAge: 65,
    weight: (l) => w(breakRecent(l), 10),
    text: () => "เด็กชายอายุเจ็ดขวบที่สูญเสียพ่อแม่ในวัน Gate Break นั่งอยู่หน้าศูนย์พักพิงคนเดียว เขาจำหน้าคุณได้จากวันนั้น และไม่ยอมปล่อยชายเสื้อคุณ",
    choices: [
      { label: "รับเขามาเป็นลูกบุญธรรม", run: (l) => { const k = createPerson(l, "child", { gender: "m", age: 7, bond: 70, lastName: l.lastName }); addStat(l, "happiness", 10); addMoney(l, -200_000); return good(`${shortName(k)} ย้ายมาอยู่กับคุณพร้อมกระเป๋าเป้ใบเดียว คืนแรกเขาถามว่า "พรุ่งนี้ยังอยู่ไหม"`); } },
      { label: "บริจาคเงินให้ศูนย์ดูแลเด็กกำพร้า", run: (l) => { addMoney(l, -300_000); addFame(l, 2); addStat(l, "happiness", 4); return good("ศูนย์ใช้เงินสร้างห้องสมุดเล็กๆ ติดป้ายชื่อคุณไว้หน้าประตู"); } },
      { label: "ส่งเขากลับให้เจ้าหน้าที่", run: (l) => { addStat(l, "happiness", -5); return meh("เขาไม่ร้อง แค่มองคุณจนลับตา"); } },
    ],
  },
  {
    id: "h16.break_memorial",
    minAge: 18,
    maxAge: 100,
    weight: (l) => w(breakRecent(l) && (!!l.flags.breakHero || !!l.flags.breakSaver), 30),
    text: () => "พิธีรำลึกผู้เสียชีวิตจาก Gate Break ผู้ว่าฯ เชิญคุณขึ้นกล่าวในฐานะคนที่อยู่ในเหตุการณ์",
    choices: [
      { label: "พูดจากใจ", check: { stat: "looks", dc: 50 }, skill: ["perform", "social"], run: (l, _c, ok) => (ok ? (addFame(l, 6), addStat(l, "happiness", 4), good("คุณพูดถึงชื่อคนที่ช่วยไม่ทันทีละคน ทั้งลานเงียบจนได้ยินเสียงลม คลิปสุนทรพจน์ถูกเปิดในโรงเรียนทั่วประเทศ")) : meh("เสียงคุณสั่นจนพูดไม่จบ แต่ไม่มีใครหัวเราะ หลายคนเข้ามากอดคุณหลังพิธี")) },
      { label: "ปฏิเสธ ขอวางดอกไม้เงียบๆ", run: (l) => { addStat(l, "happiness", 2); return meh("คุณวางดอกไม้หนึ่งดอก แล้วยืนอยู่ตรงนั้นนานกว่าใคร"); } },
    ],
  },
  {
    id: "h16.break_blame",
    minAge: 20,
    maxAge: 90,
    weight: (l) => w(breakRecent(l) && !!myGuild(l), 25),
    text: (l) => `สื่อขุดได้ว่า Gate ที่แตกเคยถูกจองโดย「${myGuild(l)}」 แต่สมาชิกเลื่อนวันเข้าเคลียร์ แฮชแท็ก #ยุบ${myGuild(l)} ขึ้นเทรนด์`,
    choices: [
      { label: "แถลงขอโทษและรับผิดชอบเต็มที่", run: (l) => { addMoney(l, -2_000_000); addRep(l, -5); addFame(l, 2); return meh("คุณโค้งต่อหน้ากล้องและตั้งกองทุนเยียวยา ชื่อเสียงกิลด์ตก แต่คนจำได้ว่าคุณไม่หนี"); } },
      { label: "เปิดหลักฐานว่าสมาคมเป็นคนสั่งเลื่อน", check: { stat: "smarts", dc: 60 }, skill: ["business", "social"], run: (l, _c, ok) => (ok ? (addRep(l, 6), good("อีเมลจากสมาคมยืนยันทุกอย่าง กระแสพลิกในคืนเดียว ผู้อำนวยการสาขาลาออก")) : (addRep(l, -15), addFame(l, -8), bad("หลักฐานของคุณมีช่องโหว่ สื่อเรียกว่า \"โยนความผิด\""))) },
      { label: "เงียบ รอให้กระแสหายไปเอง", run: (l) => { addRep(l, -10); return bad("สามเดือนผ่านไป กระแสหายไปจริง แต่ผู้สมัครเข้ากิลด์ปีนี้ลดลงครึ่งหนึ่ง"); } },
    ],
  },
  {
    id: "h16.break_buyer",
    minAge: 18,
    maxAge: 100,
    weight: (l) => w(breakNow(l) && CORE_TIERS.some((_t, i) => coresOf(l, i) > 0), 30),
    prepare: (l) => ({ t: [3, 2, 1, 0].find((i) => coresOf(l, i) > 0) ?? 0 }),
    text: (l, c) => `โรงไฟฟ้าที่เสียหายจาก Gate Break ต้องการคอร์ด่วน ตัวแทนโทรมาขอซื้อ${CORE_TIERS[Number(c.t)].name}ของคุณ ราคาตลาดตอนนี้ ${money(l, corePrice(l, Number(c.t)))} ต่อก้อน`,
    choices: [
      { label: "ขายให้หมดตอนราคาพุ่ง", run: (l, c) => sellCores(l, Number(c.t), 99) },
      { label: "ขายครึ่งเดียว เก็บไว้ลุ้นต่อ", run: (l, c) => sellCores(l, Number(c.t), Math.max(1, Math.floor(coresOf(l, Number(c.t)) / 2))) },
      { label: "บริจาคหนึ่งก้อนให้โรงพยาบาลสนาม", run: (l, c) => { addCores(l, Number(c.t), -1); addFame(l, 6); addStat(l, "happiness", 6); return good("เครื่องช่วยหายใจทั้งตึกกลับมาทำงาน หัวหน้าพยาบาลก้มหัวให้คุณจนหน้าผากแทบติดพื้น"); } },
    ],
  },
  {
    id: "h16.break_looters",
    minAge: 16,
    maxAge: 70,
    weight: (l) => w(breakNow(l) && !awake(l), 25),
    text: () => "หลังมอนสเตอร์ถูกกำจัด ร้านทองหัวมุมถนนกระจกแตกทั้งร้าน วัยรุ่นกลุ่มหนึ่งกำลังกวาดของใส่ถุง หนึ่งในนั้นยื่นสร้อยมาให้คุณ \"เอาไปดิ ไม่มีใครรู้หรอก\"",
    choices: [
      { label: "ไล่พวกมันไปแล้วเฝ้าร้านให้เจ้าของ", check: { stat: "health", dc: 55 }, skill: ["combat", "social"], run: (l, _c, ok) => (ok ? (addFame(l, 3), addMoney(l, 50_000), good("เจ้าของร้านกลับมาเจอคุณนั่งเฝ้าอยู่หน้าร้าน เธอยัดซองให้คุณ \"ยังมีคนดีเหลืออยู่ในเมืองนี้\"")) : bad("พวกมันห้าคน คุณคนเดียว" + hurt(l, 5, 12, "ถูกรุมทำร้ายหลัง Gate Break"))) },
      { label: "รับสร้อยมา", run: (l) => { addMoney(l, 40_000); addStat(l, "happiness", -6); l.flags.looted = true; return meh("สร้อยหนักกว่าที่คิด หนักทุกครั้งที่หยิบขึ้นมาดู"); } },
      { label: "เดินจากไปเงียบๆ", run: () => meh("คุณไม่ได้ทำอะไรผิด แต่ก็ไม่ได้ทำอะไรถูก") },
    ],
  },
  {
    id: "h16.break_volunteer",
    minAge: 14,
    maxAge: 80,
    weight: (l) => w(breakRecent(l), 18),
    text: () => "เขตที่โดน Gate Break ยังเป็นซากปรักหักพัง ป้ายรับสมัครอาสาสมัครเก็บกวาดติดอยู่ทุกเสาไฟ — งานหนัก ไม่มีค่าแรง มีข้าวกล่องให้",
    choices: [
      { label: "ลงไปช่วยทั้งเดือน", run: (l) => { addStat(l, "health", -3); addStat(l, "happiness", 8); addFame(l, 2); if (chance(l, 0.25)) { addCores(l, 0, 1); return good("ระหว่างขุดซาก คุณเจอเศษคอร์ก้อนเล็กที่หน่วยเก็บกู้มองข้าม หัวหน้าอาสาบอกให้เก็บไว้เป็นค่าแรง"); } return good("มือพองหมด แต่คุณได้รู้จักคนในเขตเดียวกันมากกว่าที่อยู่มาสิบปี"); } },
      { label: "บริจาคของแทน", run: (l) => { addMoney(l, -20_000); addStat(l, "happiness", 3); return meh("น้ำดื่มสองร้อยแพ็กถูกส่งไปพร้อมโน้ตเล็กๆ ว่า \"สู้ๆ นะ\""); } },
      { label: "ไม่ใช่เรื่องของเรา", run: (l) => { addStat(l, "happiness", -2); return meh("ถนนเส้นนั้นปิดไปอีกครึ่งปี คุณต้องอ้อมไปทำงานทุกวัน"); } },
    ],
  },
  {
    id: "h16.break_drill",
    minAge: 6,
    maxAge: 17,
    weight: (l) => w(!breakRecent(l), 6),
    text: () => "โรงเรียนจัดซ้อมอพยพ Gate Break ประจำปี ครูพละถือโทรโข่ง \"ใครวิ่งช้าสุดต้องเป็นเหยื่อล่อมอนสเตอร์!\" (ครูล้อเล่น… มั้ง)",
    choices: [
      { label: "ซ้อมจริงจัง", check: { stat: "health", dc: 45 }, run: (l, _c, ok) => (ok ? (addStat(l, "health", 2), good("คุณถึงจุดรวมพลเป็นคนแรก ครูให้ดาวทองหนึ่งดวง")) : meh("คุณสะดุดเชือกรองเท้าตัวเองตรงบันได เพื่อนทั้งชั้นจำได้จนจบ ม.6")) },
      { label: "แอบหลบไปกินขนมหลังโรงอาหาร", run: (l) => { addStat(l, "happiness", 3); l.flags.skipDrill = true; return meh("ครูนับคนขาดหนึ่ง แล้วประกาศชื่อคุณผ่านลำโพงทั้งโรงเรียน \"นักเรียนคนนี้ถูกมอนสเตอร์กินไปแล้วนะคะ\""); } },
    ],
  },
  {
    id: "h16.break_hero_kid",
    minAge: 5,
    maxAge: 15,
    weight: (l) => w(breakRecent(l), 14),
    text: () => "Hunter ที่สกัดมอนสเตอร์หน้าโรงเรียนคุณในวัน Gate Break กลับมาเยี่ยม เขาแขนข้างหนึ่งเข้าเฝือก แต่ยังยิ้มแจกลายเซ็นให้เด็กทุกคน",
    choices: [
      { label: "ถามว่าทำยังไงถึงจะเก่งแบบพี่", run: (l) => { l.flags.dreamHunter = true; addStat(l, "health", 2); return good("\"กินผัก นอนเร็ว แล้วอย่าวิ่งหนีตอนเพื่อนต้องการ\" คุณจดใส่สมุดทุกคำ"); } },
      { label: "ให้ขนมที่มีอยู่ชิ้นเดียว", run: (l) => { addStat(l, "happiness", 6); return good("เขาหัวเราะแล้วแบ่งครึ่งกับคุณ ขนมชิ้นนั้นอร่อยที่สุดในชีวิต"); } },
    ],
  },
  {
    id: "h16.break_family_worry",
    minAge: 30,
    maxAge: 90,
    weight: (l) => w(breakNow(l) && people(l, "child").some((k) => k.age >= 18), 15),
    text: () => "ข่าว Gate Break ขึ้นทุกช่อง โทรศัพท์ลูกคุณติดต่อไม่ได้มาสามชั่วโมงแล้ว ที่ทำงานของเขาอยู่ห่างจากจุดเกิดเหตุสองช่วงตึก",
    choices: [
      { label: "ขับรถฝ่าด่านเข้าไปหา", odds: (l) => (l.power ? 0.85 : 0.6), run: (l, _c, ok) => (ok ? (addStat(l, "happiness", 6), good("คุณเจอเขานั่งอยู่หน้าตึก แบตหมดเฉยๆ ทั้งคู่กอดกันกลางถนนท่ามกลางเสียงไซเรน")) : bad("ทหารกั้นรถคุณไว้ที่ด่านแรก ลูกโทรกลับมาตอนเที่ยงคืนว่าปลอดภัย คุณร้องไห้คนเดียวในรถ" + hurt(l, 2, 6, "หัวใจวายระหว่างรอข่าวลูก"))) },
      { label: "นั่งรอข่าวข้างโทรศัพท์", run: (l) => { addStat(l, "happiness", -4); addStat(l, "health", -2); return meh("ข้อความเดียวเด้งขึ้นมาตอนตีสอง: \"ผมโอเค ไม่ต้องห่วง\" คุณอ่านมันสิบรอบ"); } },
    ],
  },
];
