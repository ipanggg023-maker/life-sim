// โลกแฟนตาซี "คัมภีร์ดวงดาว": ชีวิตคือกลุ่มดาว · ส่วนประกอบเฉพาะโลกนี้ (ท้องฟ้า แอสโตรเลบ หน้าปัดค่าพลัง กลุ่มดาวแห่งชีวิต ฉากไพ่ชะตา แผนภูมิกำเนิด ฟ้าแห่งตำนาน)
// สไตล์อยู่ใน ui/astral.css · ทุกอย่างเป็นของประดับ ตัวเลขและปุ่มจริงยังอยู่ในหน้าจอเดิม
import { useMemo } from "react";
import { fl, type RaceId } from "../content/fantasy/state";
import type { Life, StatKey } from "../engine/types";

/** ดาวสี่แฉกรอบจุด (x, y) รัศมี r */
const sparkPath = (x: number, y: number, r: number) =>
  `M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`;
const short = (s: string, n = 12) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
/** ตัวเลขสุ่มคงที่จากข้อความ (ให้ฉากเดิมได้หน้าตาเดิมทุกครั้ง) */
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/** ท้องฟ้ากลางคืนหลังทุกหน้าจอ: ดาวสามชั้น ทางช้างเผือก แสงวาบ และดาวตกนานๆ ครั้ง */
export function AstralSky() {
  const layers = useMemo(() => ({
    far: Array.from({ length: 70 }, (_, k) => ({ x: (k * 37 + 3) % 100, y: (k * 61 + 17) % 100, d: (k * 0.53) % 5 })),
    mid: Array.from({ length: 32 }, (_, k) => ({ x: (k * 53) % 100, y: (k * 29 + 11) % 100, r: k % 4 === 0 ? 2.2 : 1.4, d: (k * 0.37) % 3.4 })),
    glint: [[12, 6, 0], [86, 22, 1.4], [70, 58, 2.6], [6, 74, 3.3], [92, 90, 0.7]],
  }), []);
  return (
    <div className="astral-sky" aria-hidden="true">
      <div className="sky-band" />
      <div className="sky-band thin" />
      <div className="sky-nebula" />
      <div className="sky-far">
        {layers.far.map((s, i) => <span key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />)}
      </div>
      <div className="sky-mid">
        {layers.mid.map((s, i) => <span key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r, animationDelay: `${s.d}s` }} />)}
      </div>
      {layers.glint.map(([x, y, d], i) => <span key={i} className="sky-glint" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />)}
      <span className="sky-shoot" />
    </div>
  );
}

const GLYPHS = ["M0 -3.4L1 0 0 3.4-1 0Z", "M-2.4 -2A3 3 0 1 0 2.4 -2 2.2 2.2 0 1 1-2.4 -2", "M0 -3L2.6 2H-2.6Z", "M-2.6 0H2.6M0 -2.6V2.6"];

/** แอสโตรเลบบอกอายุ: วงนอกหมุนช้าตลอด ส่วนกลางหมุนหนึ่งช่องทุกปี ตัวเลขเลื่อนขึ้นและมีแสงวาบ */
export function Astrolabe({ age }: { age: number }) {
  const glyphs = useMemo(() => Array.from({ length: 12 }, (_, k) => {
    const a = (k / 12) * 360, rad = ((a - 90) * Math.PI) / 180;
    return { t: `translate(${(64 + Math.cos(rad) * 49.5).toFixed(1)} ${(64 + Math.sin(rad) * 49.5).toFixed(1)}) rotate(${a})`, d: GLYPHS[k % 4] };
  }), []);
  const big = age >= 100;
  return (
    <svg className="astrolabe" viewBox="0 0 128 128" width="104" height="104" role="img" aria-label={`อายุ ${age} ปี`}>
      <defs>
        <linearGradient id="ast-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF1C4" /><stop offset=".45" stopColor="#D9B56A" /><stop offset="1" stopColor="#8E6A2C" /></linearGradient>
        <radialGradient id="ast-disk" cx=".5" cy=".42" r=".6"><stop offset="0" stopColor="#262C6A" /><stop offset="1" stopColor="#0D1131" /></radialGradient>
        <radialGradient id="ast-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#F0D492" stopOpacity=".5" /><stop offset="1" stopColor="#F0D492" stopOpacity="0" /></radialGradient>
      </defs>
      <circle className="ast-core" cx="64" cy="64" r="64" fill="url(#ast-glow)" />
      <g className="ast-cw">
        <circle cx="64" cy="64" r="61" fill="none" stroke="url(#ast-gold)" strokeWidth="1" />
        <circle cx="64" cy="64" r="58" fill="none" stroke="#D9B56A" strokeOpacity=".5" strokeWidth="4" strokeDasharray=".5 2.536" />
        <circle cx="64" cy="64" r="58" fill="none" stroke="#F0D492" strokeWidth="7" strokeDasharray=".9 29.47" />
        <circle cx="64" cy="64" r="54.5" fill="none" stroke="#D9B56A" strokeOpacity=".45" strokeWidth=".6" />
        {glyphs.map((g, i) => <path key={i} transform={g.t} d={g.d} fill="none" stroke="#F0D492" strokeWidth=".9" strokeLinecap="round" />)}
        <circle cx="64" cy="64" r="44" fill="none" stroke="#D9B56A" strokeOpacity=".55" strokeWidth=".7" />
      </g>
      <g className="ast-rete" style={{ transform: `rotate(${-age * 30}deg)` }}>
        <ellipse cx="64" cy="70" rx="36" ry="30" fill="none" stroke="#9FC4F0" strokeOpacity=".55" strokeWidth=".8" />
        <path d="M64 22C70 34 70 40 64 46 58 40 58 34 64 22Z" fill="url(#ast-gold)" />
        <path d="M100 58C92 60 88 63 86 68M28 76C36 72 40 70 44 64M80 100C76 94 74 90 72 84" fill="none" stroke="#F0D492" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="100" cy="58" r="2.2" fill="#FFF1C4" /><circle cx="28" cy="76" r="1.8" fill="#FFF1C4" /><circle cx="80" cy="100" r="1.8" fill="#9FC4F0" />
      </g>
      <g className="ast-orbit">
        <circle cx="64" cy="64" r="38" fill="none" stroke="#9FC4F0" strokeOpacity=".14" strokeDasharray="1 4" />
        <circle cx="64" cy="26" r="2.6" fill="#9FC4F0" />
      </g>
      <circle cx="64" cy="64" r="31" fill="url(#ast-disk)" stroke="url(#ast-gold)" strokeWidth="1.3" />
      <circle cx="64" cy="64" r="27.5" fill="none" stroke="#D9B56A" strokeOpacity=".35" strokeWidth=".6" strokeDasharray="2 2.3" />
      <g key={age}>
        <circle className="ast-pulse" cx="64" cy="64" r="31" fill="none" stroke="#F0D492" strokeWidth="1.5" />
        <text className="ast-age" x="64" y={big ? 69 : 71} textAnchor="middle" style={{ fontSize: big ? 22 : 28 }}>{age}</text>
      </g>
      <text className="ast-unit" x="64" y="84" textAnchor="middle">ปี</text>
    </svg>
  );
}

const DIAL: Record<string, string> = { health: "#E8897A", happiness: "#EAC56E", smarts: "#9FC4F0", looks: "#CFA8EC" };
/** หน้าปัดค่าพลัง: ส่วนโค้งยาวตามค่า ปลายมีจุดเรืองแสง ขอบมีขีดองศา */
export function StatDial({ k, label, value }: { k: StatKey; label: string; value: number }) {
  const c = DIAL[k] ?? "#9FC4F0";
  return (
    <div className={`dial ${value < 25 ? "low" : ""}`}>
      <div className="dial-ring">
        <svg viewBox="0 0 58 58" width="54" height="54" aria-hidden="true">
          <circle cx="29" cy="29" r="26.5" fill="none" stroke="#D9B56A" strokeOpacity=".28" strokeWidth="2.6" strokeDasharray=".4 3.76" />
          <circle cx="29" cy="29" r="21" fill="rgba(18,22,60,.6)" stroke="#fff" strokeOpacity=".07" strokeWidth="3" />
          <circle className="dial-arc" cx="29" cy="29" r="21" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${value} 100`} transform="rotate(-90 29 29)" style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
          <g className="dial-tip" style={{ transform: `rotate(${value * 3.6}deg)` }}><circle cx="29" cy="8" r="2.4" fill="#FFF6DA" style={{ filter: `drop-shadow(0 0 4px ${c})` }} /></g>
        </svg>
        <span className="dial-val">{value}</span>
      </div>
      <span className="dial-label">{label}</span>
    </div>
  );
}

const SPOTS: [number, number][] = [[22, 62], [72, 34], [122, 56], [172, 26], [222, 50], [272, 24], [318, 56]];
/** กลุ่มดาวแห่งชีวิต: ทุกเรื่องที่ทำไว้คือดาวหนึ่งดวง ดวงใหม่จุดประกายและลากเส้นหาดวงก่อน */
export function LifeConstellation({ life }: { life: Life }) {
  const deeds = life.ft?.deeds ?? [];
  const labels = ["กำเนิด", ...deeds].slice(-SPOTS.length);
  const n = labels.length;
  const fresh = deeds.length > 0;
  return (
    <section className="life-stars" aria-label={`กลุ่มดาวแห่งชีวิต ${n} ดวง`}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <div className="life-stars-head"><span />กลุ่มดาวแห่งชีวิต · {deeds.length + 1} ดวง<span /></div>
      <svg viewBox="0 0 340 92" width="100%" height="92" aria-hidden="true">
        <path d="M0 70Q170 40 340 70M0 40Q170 10 340 40" fill="none" stroke="#9FC4F0" strokeOpacity=".08" />
        <path d="M60 0Q70 46 60 92M170 0V92M280 0Q270 46 280 92" fill="none" stroke="#9FC4F0" strokeOpacity=".07" />
        {SPOTS.slice(n).map(([x, y], i) => <circle key={`g${i}`} cx={x} cy={y} r="1.5" fill="#A9A2C0" fillOpacity=".3" />)}
        {SPOTS.slice(1, n).map(([x, y], i) => {
          const last = i === n - 2;
          return <line key={last ? `l${deeds.length}` : `l${i}`} className={last && fresh ? "ls-draw" : ""} x1={SPOTS[i][0]} y1={SPOTS[i][1]} x2={x} y2={y} pathLength={1} stroke="#E6C77E" strokeOpacity=".8" strokeWidth="1" />;
        })}
        {SPOTS.slice(0, n).map(([x, y], i) => {
          const last = i === n - 1;
          return (
            <g key={last ? `s${deeds.length}` : `s${i}`}>
              <circle className="ls-halo" cx={x} cy={y} r="7.5" fill="#F0D492" fillOpacity=".16" style={{ animationDelay: `${i * 0.4}s` }} />
              {last && fresh && <circle className="ls-shock" cx={x} cy={y} r="6" fill="none" stroke="#FFF1C4" strokeWidth="1" />}
              <path className={last && fresh ? "ls-ignite" : ""} d={sparkPath(x, y, last ? 6 : 4.4)} fill="#FFF6DA" />
              <text className={last && fresh ? "ls-label new" : "ls-label"} x={x} y={y > 46 ? y + 18 : y - 11} textAnchor="middle">{short(labels[i])}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

const PALETTES = [
  { sky: ["#161A4C", "#2C2770", "#4A3B86"], hill: "#1B1B4A", near: "#0F1036", flagA: "#B23A48", flagB: "#2D5FA8" },
  { sky: ["#0E1C3E", "#1C3B66", "#2F6A86"], hill: "#122848", near: "#0A1830", flagA: "#C9963E", flagB: "#6FB3C9" },
  { sky: ["#2A1236", "#5A2448", "#8A3E4E"], hill: "#24123A", near: "#170A26", flagA: "#E0B04A", flagB: "#7A3E8A" },
];
/** ภาพหัวไพ่ชะตา: ฟ้า จันทร์ เมฆลอย ปราสาทกับธงสะบัด · แต่ละเหตุการณ์ได้โทนและตำแหน่งจันทร์ของตัวเอง */
export function FateScene({ id }: { id: string }) {
  const h = hash(id), p = PALETTES[h % PALETTES.length], mx = 70 + (h % 220), castle = h % 2 === 0;
  return (
    <div className="fate-scene" aria-hidden="true" style={{ background: `linear-gradient(180deg, ${p.sky[0]} 0%, ${p.sky[1]} 55%, ${p.sky[2]} 100%)` }}>
      <svg viewBox="0 0 344 150" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
        <circle className="fs-pulse" cx={mx} cy="46" r="40" fill="#F4ECD8" fillOpacity=".12" />
        <circle cx={mx} cy="46" r="24" fill="#F4ECD8" />
        <circle cx={mx - 7} cy="41" r="3.4" fill="#DCD2B8" /><circle cx={mx + 5} cy="53" r="5" fill="#DCD2B8" /><circle cx={mx + 9} cy="38" r="2.2" fill="#DCD2B8" />
        <g className="fs-cloud a" opacity=".5"><path d="M30 74q12-14 30-6 10-12 28-2 18 0 18 12H24q-6 0 6-4z" fill="#5A4E9A" /></g>
        <g className="fs-cloud b" opacity=".38"><path d="M200 92q14-12 30-4 12-10 26 0 16 2 14 12h-78z" fill="#6A5BA8" /></g>
        <path d="M0 150V108Q50 86 96 100 130 74 176 94 214 76 252 96 300 82 344 100V150Z" fill={p.hill} />
        {castle ? (
          <>
            <path d="M126 98V64h8V54h6v10h8V54h6v10h8v34Z" fill={p.near} />
            <path d="M150 54V32h4v22Z" fill={p.near} />
            <path className="fs-flag" d="M154 32h14l-4 5 4 5h-14Z" fill={p.flagA} />
            <path d="M210 96V70h6v-8h5v8h6v26Z" fill={p.near} />
            <path className="fs-flag" d="M221 56h10l-3 4 3 4h-10Z" fill={p.flagB} />
            <circle className="fs-torch" cx="130" cy="86" r="4.5" fill="#F3B45A" fillOpacity=".55" />
          </>
        ) : (
          <path d="M40 104l10-26 10 26ZM60 106l12-34 12 34ZM250 102l11-30 11 30ZM272 104l9-22 9 22Z" fill={p.near} />
        )}
        <path d="M0 150V124Q86 104 172 120 258 104 344 124V150Z" fill={p.near} />
      </svg>
    </div>
  );
}

const RACE_SHAPES: Record<RaceId, [number, number][]> = {
  human: [[156, 80], [114, 128], [156, 172], [198, 128], [156, 236]],
  elf: [[94, 100], [156, 70], [218, 100], [188, 168], [156, 236], [124, 168]],
  dwarf: [[84, 210], [124, 130], [156, 160], [188, 130], [228, 210]],
  orc: [[104, 92], [208, 92], [228, 180], [156, 236], [84, 180]],
  beastfolk: [[94, 120], [134, 80], [174, 120], [214, 80], [196, 200], [116, 200]],
  halfling: [[156, 90], [196, 150], [156, 210], [116, 150]],
  dragon: [[70, 170], [110, 110], [156, 140], [200, 80], [246, 120], [214, 196], [150, 220]],
  demon: [[100, 80], [130, 140], [156, 110], [182, 140], [212, 80], [156, 230]],
};
/** แผนภูมิกำเนิด: วงราศีหมุนช้า และกลุ่มดาวของเผ่าที่ลากเส้นขึ้นใหม่ทุกครั้งที่เปลี่ยนเผ่า */
export function BirthChart({ race, name }: { race: RaceId; name: string }) {
  const shape = RACE_SHAPES[race] ?? RACE_SHAPES.human;
  return (
    <div className="birth-chart" aria-hidden="true">
      <svg className="bc-wheel" viewBox="0 0 312 312" width="260" height="260">
        <defs><path id="bc-zod" d="M156 18A138 138 0 1 1 155.9 18" /></defs>
        <circle className="bc-glow" cx="156" cy="156" r="120" fill="none" stroke="#F0D492" strokeOpacity=".12" strokeWidth="30" />
        <g className="bc-cw">
          <circle cx="156" cy="156" r="152" fill="none" stroke="#D9B56A" strokeOpacity=".45" />
          <circle cx="156" cy="156" r="146" fill="none" stroke="#D9B56A" strokeOpacity=".4" strokeWidth="6" strokeDasharray=".7 6.94" />
          <circle cx="156" cy="156" r="146" fill="none" stroke="#F0D492" strokeWidth="9" strokeDasharray="1 75.4" />
          <text className="bc-zod"><textPath href="#bc-zod">ราศีมังกร   ✦   ราศีพายุ   ✦   ราศีมงกุฎ   ✦   ราศีหอก   ✦   ราศีจันทร์   ✦   ราศีพฤกษ์   ✦   ราศีเพลิง   ✦   ราศีคลื่น   ✦</textPath></text>
          <circle cx="156" cy="156" r="128" fill="none" stroke="#D9B56A" strokeOpacity=".3" />
        </g>
        <g className="bc-ccw">
          <circle cx="156" cy="156" r="108" fill="none" stroke="#9FC4F0" strokeOpacity=".22" strokeDasharray="1 6" />
          <path d="M156 48V264M48 156H264M80 80 232 232M232 80 80 232" stroke="#9FC4F0" strokeOpacity=".08" />
        </g>
        <g key={race}>
          {shape.slice(1).map(([x, y], i) => <line key={i} className="bc-trace" x1={shape[i][0]} y1={shape[i][1]} x2={x} y2={y} pathLength={1} stroke="#E6C77E" strokeOpacity=".85" strokeWidth="1.2" style={{ animationDelay: `${0.3 + i * 0.22}s` }} />)}
          {shape.map(([x, y], i) => (
            <g key={`p${i}`}>
              <circle className="bc-pop" cx={x} cy={y} r="11" fill="#F0D492" fillOpacity=".14" style={{ animationDelay: `${i * 0.2}s` }} />
              <path className="bc-pop" d={sparkPath(x, y, i === 0 ? 7 : 5)} fill="#FFF6DA" style={{ animationDelay: `${i * 0.2}s` }} />
            </g>
          ))}
        </g>
      </svg>
      <span key={race} className="bc-name">กลุ่มดาว{name}</span>
    </div>
  );
}

const LEGEND: [number, number][] = [[40, 196], [92, 146], [134, 170], [174, 98], [220, 128], [260, 64], [308, 92], [286, 188]];
/** ฟ้าแห่งตำนาน: ชีวิตที่จบลงกลายเป็นกลุ่มดาว ทุกเรื่องที่ทำไว้มีชื่อกำกับ และประกายไฟลอยขึ้นฟ้า */
export function LegendSky({ life }: { life: Life }) {
  const deeds = life.ft ? fl(life).deeds : [];
  const labels = ["กำเนิด", ...deeds.slice(-(LEGEND.length - 2)), "จากไป"];
  const pts = LEGEND.slice(0, labels.length);
  const embers = useMemo(() => Array.from({ length: 12 }, (_, k) => ({ x: 8 + ((k * 23) % 84), sway: (k % 2 ? 1 : -1) * (10 + ((k * 7) % 30)), dur: 9 + (k % 5) * 2, d: k * 0.8 })), []);
  return (
    <div className="legend-sky" aria-hidden="true">
      <div className="legend-pillar" />
      {embers.map((e, i) => <span key={i} className="legend-ember" style={{ left: `${e.x}%`, ["--sway" as string]: `${e.sway}px`, animationDuration: `${e.dur}s`, animationDelay: `${e.d}s` }} />)}
      <svg viewBox="0 0 350 250" width="100%" height="230">
        {pts.slice(1).map(([x, y], i) => <line key={i} className="lg-trace" x1={pts[i][0]} y1={pts[i][1]} x2={x} y2={y} pathLength={1} stroke="#E6C77E" strokeOpacity=".9" strokeWidth="1.2" style={{ animationDelay: `${0.4 + i * 0.22}s` }} />)}
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle className="lg-pop" cx={x} cy={y} r="12" fill="#F0D492" fillOpacity=".14" style={{ animationDelay: `${0.2 + i * 0.22}s` }} />
            <path className="lg-pop" d={sparkPath(x, y, i === Math.min(5, pts.length - 1) ? 8 : 5.5)} fill="#FFF8E0" style={{ animationDelay: `${0.2 + i * 0.22}s` }} />
            <text className="lg-label" x={x} y={y < 110 ? y - 14 : y + 20} textAnchor="middle" style={{ animationDelay: `${1.2 + i * 0.22}s` }}>{short(labels[i], 14)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
