import { useState } from "react";

const KEY = "ls.onboarded.murim";
const STEPS = [
  {
    emoji: "🏮",
    title: "หนึ่งปี หนึ่งก้าว",
    text: "กด ＋ อายุ 1 ปี เพื่อใช้ชีวิตไปทีละปี เลือกแผนประจำปีเหนือปุ่ม (ฝึกวิชา ทำงาน ดูแลครอบครัว ท่องยุทธภพ…) แล้วเหตุการณ์จะเกิดจากชีวิตที่คุณเลือกเอง",
  },
  {
    emoji: "⏳",
    title: "เวลามีจำกัด",
    text: "แท็บ ทำ และงานในแท็บ อาชีพ ใช้เวลาของปีเดียวกัน ผู้ใหญ่มีปีละ 5 ส่วน เดินทางไกลกินสองส่วน — เลือกให้คุ้ม แล้วค่อยกด +1 ปี",
  },
  {
    emoji: "🎲",
    title: "เห็นโอกาสก่อนเลือก",
    text: "ทุกตัวเลือกบอก % สำเร็จตามฝีมือและสเตตัสของคุณจริง ตัวเลือกที่อาจถึงตายจะมีคำเตือนอัตรารอดชีวิต ผลลัพธ์สีเขียวคือสำเร็จ สีแดงคือพลาด",
  },
  {
    emoji: "📜",
    title: "ผู้คนจำคุณได้",
    text: "แตะชื่อคนในบันทึกเพื่อดูเขา ใช้ตัวกรองเหนือบันทึกหาเรื่องสำคัญ ตายแล้วเล่นต่อได้เป็นลูก ศิษย์ หรือคนรุ่นหลังในโลกเดิม",
  },
];

const seen = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
};

/** คำแนะนำสั้นๆ สำหรับผู้เล่นใหม่ (EXPANSION §18) — ข้ามได้ทุกเมื่อ แสดงครั้งเดียวต่อเครื่อง */
export function Onboarding() {
  const [step, setStep] = useState(() => (seen() ? -1 : 0));
  if (step < 0) return null;
  const done = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ไม่มี storage — ปิดแค่รอบนี้ */
    }
    setStep(-1);
  };
  const s = STEPS[step];
  return (
    <div className="overlay modal-overlay">
      <div className="modal onboard">
        <div className="onboard-emoji" aria-hidden>
          {s.emoji}
        </div>
        <h3>{s.title}</h3>
        <p className="modal-text">{s.text}</p>
        <div className="onboard-dots" aria-label={`ขั้นที่ ${step + 1} จาก ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? "on" : ""} />
          ))}
        </div>
        <div className="row onboard-row">
          <button className="btn ghost" onClick={done}>
            ข้าม
          </button>
          <button className="btn primary" onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : done())}>
            {step + 1 < STEPS.length ? "ต่อไป" : "เริ่มเล่น"}
          </button>
        </div>
      </div>
    </div>
  );
}
