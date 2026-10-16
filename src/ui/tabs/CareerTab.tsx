import { CAREERS, careerById, facultyById } from "../../content/hunter/careers";
import { worldMatches } from "../../content/worlds";
import { applyJob, gradeToGpa, isStudent, jobChance, jobRequirementMissing, quitJob, salaryOf, studyHard, workHard } from "../../engine/game";
import type { Life, SchoolStage } from "../../engine/types";
import { money } from "../../engine/util";
import type { Act } from "../App";

const STAGE_LABEL: Record<SchoolStage, string> = {
  none: "ยังไม่เข้าเรียน",
  kinder: "อนุบาล",
  primary: "ประถมศึกษา",
  secondary: "มัธยมต้น",
  high: "มัธยมปลาย",
  university: "มหาวิทยาลัย",
  done: "จบการศึกษา",
};

export function CareerTab({ life, act }: { life: Life; act: Act }) {
  const ed = life.education;
  const job = life.job;
  const career = job ? careerById(job.careerId) : undefined;

  return (
    <div className="tab-content">
      {life.worldId !== "hunter" ? null : <div className="card">
        <div className="card-title">🎓 การศึกษา</div>
        <p>
          สถานะ: {STAGE_LABEL[ed.stage]}
          {ed.stage === "university" && ed.faculty && ` · คณะ${facultyById(ed.faculty).name} (เหลือ ${ed.uniYearsLeft} ปี)`}
        </p>
        {ed.degree && <p>วุฒิ: ปริญญาตรี {facultyById(ed.degree).name}</p>}
        {!ed.degree && ed.highSchoolDone && <p>วุฒิ: ม.6</p>}
        {(isStudent(life) || ed.stage === "done") && ed.stage !== "kinder" && <p>เกรดเฉลี่ย: {gradeToGpa(ed.grade)}</p>}
        {isStudent(life) && ed.stage !== "kinder" && (
          <button className="btn" disabled={life.doneThisYear.includes("study")} onClick={() => act(studyHard)}>
            📚 ตั้งใจเรียนให้หนัก
          </button>
        )}
      </div>}

      {job && career && (
        <div className="card">
          <div className="card-title">
            {career.emoji} งานปัจจุบัน
          </div>
          <p>
            <b>{career.titles[job.level - 1]}</b> · {career.name}
          </p>
          <p>รายได้ {money(life, salaryOf(life, career, job.level))}/ปี · ทำมา {job.years} ปี</p>
          <div className="mini-bar">
            <span>ผลงาน</span>
            <div className="bar">
              <div className="fill high" style={{ width: `${job.performance}%` }} />
            </div>
          </div>
          <div className="row">
            <button className="btn" disabled={life.doneThisYear.includes("workhard")} onClick={() => act(workHard)}>
              💪 ทุ่มเททำงาน
            </button>
            <button className="btn ghost" onClick={() => act(quitJob)}>
              ลาออก
            </button>
          </div>
        </div>
      )}

      {!job && (
        <>
          <div className="section-title">หางาน</div>
          {CAREERS.filter((c) => worldMatches(c.world, life.worldId)).map((c) => {
            const missing = jobRequirementMissing(life, c);
            const applied = life.doneThisYear.includes(`apply:${c.id}`);
            return (
              <div className={`job ${missing ? "locked" : ""}`} key={c.id}>
                <div className="job-main">
                  <div className="job-name">
                    {c.emoji} {c.name}
                  </div>
                  <div className="job-sub">
                    {money(life, salaryOf(life, c, 1))}/ปี
                    {missing ? ` · 🔒 ${missing}` : ` · โอกาสผ่าน ${Math.round(jobChance(life, c) * 100)}%`}
                  </div>
                </div>
                <button className="btn small" disabled={!!missing || applied} onClick={() => act((l) => applyJob(l, c.id))}>
                  {applied ? "สมัครแล้ว" : "สมัคร"}
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
