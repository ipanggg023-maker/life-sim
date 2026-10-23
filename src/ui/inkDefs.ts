// ฟิลเตอร์หมึกที่ทั้งแอปอ้างถึงด้วย url(#...) — ใส่ไว้ใน body ครั้งเดียว (design/UI_INK.md · วัสดุ)
// ink-edge: ขอบหยักแบบเส้นพู่กัน · seal: ขอบตราชาดไม่เรียบ + จุดหมึกไม่ติด · ใช้กับชั้นพื้นหลังเท่านั้น ตัวหนังสือคมเสมอ
const DEFS = `
<filter id="ink-edge" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="ink-edge-soft" x="-5%" y="-20%" width="110%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="3" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="seal" x="-8%" y="-8%" width="116%" height="116%">
  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="11" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="rough"/>
  <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="5" result="speck"/>
  <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -14 0 0 0 11.2" result="holes"/>
  <feComposite in="rough" in2="holes" operator="in"/>
</filter>`;

export function mountInkDefs() {
  if (typeof document === "undefined" || document.getElementById("ink-defs")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "ink-defs";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  svg.innerHTML = `<defs>${DEFS}</defs>`;
  document.body.prepend(svg);
}
