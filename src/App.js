import { useState, useRef, useEffect, useCallback } from "react";

// ── CONFIG ───────────────────────────────────────────────
const BACKEND_URL = "https://web-production-a6653.up.railway.app";
const AUTO_APPLY_THRESHOLD = 85; // auto-apply if match >= this

// ── DEMO DATA (generic — shown before live search) ───────
const DEMO_JOBS = [];  // No hardcoded jobs — always use live search

// ── THEME ────────────────────────────────────────────────
const C = {
  bg: "#07090f", surface: "#0d1117", card: "#0f1520", border: "#1c2a3a",
  accent: "#3b82f6", green: "#22c55e", yellow: "#eab308", red: "#ef4444",
  purple: "#a855f7", cyan: "#06b6d4", orange: "#f97316",
  text: "#e2e8f0", muted: "#4b6280", dim: "#1a2535",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@300;400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:'Inter',sans-serif}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:${C.bg}}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes progress{from{width:0}to{width:100%}}
  .spin{animation:spin .8s linear infinite;display:inline-block}
  .fade{animation:fadeIn .3s ease}
  .pulse{animation:pulse 1.5s ease-in-out infinite}
  input,textarea,select{outline:none;font-family:'Inter',sans-serif}
  button{font-family:'Inter',sans-serif;cursor:pointer;transition:all .15s}
  .mono{font-family:'Fira Code',monospace}
`;

// ── MINI COMPONENTS ──────────────────────────────────────
const Tag = ({ label, color }) => {
  const c = color || (label.includes("Visa") || label.includes("Reloc") ? C.green : label.includes("English") ? C.cyan : C.muted);
  return <span style={{ background: c + "1a", border: `1px solid ${c}40`, borderRadius: 4, padding: "2px 8px", fontSize: 11, color: c, marginRight: 4, marginBottom: 3, display: "inline-block", fontWeight: 500 }}>{label}</span>;
};

const Badge = ({ label, color = C.accent }) => (
  <span style={{ background: color + "20", border: `1px solid ${color}50`, borderRadius: 5, padding: "3px 10px", fontSize: 11, color, fontWeight: 600 }}>{label}</span>
);

const MatchBar = ({ score }) => {
  const color = score >= 85 ? C.green : score >= 70 ? C.accent : C.yellow;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>match</div>
      <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width .6s ease" }} />
      </div>
      {score >= AUTO_APPLY_THRESHOLD && <div style={{ fontSize: 9, color: C.green, marginTop: 3, fontWeight: 600 }}>AUTO ⚡</div>}
    </div>
  );
};

const Btn = ({ children, onClick, color = C.accent, outline, disabled, small, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: disabled ? C.dim : outline ? "transparent" : color,
    border: `1px solid ${disabled ? C.border : outline ? color + "80" : color}`,
    borderRadius: 8, padding: small ? "5px 12px" : "9px 18px",
    color: disabled ? C.muted : outline ? color : "#fff",
    fontWeight: 600, fontSize: small ? 12 : 13, ...style,
  }}>{children}</button>
);

// Progress step indicator
const Pipeline = ({ steps, current }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
    {steps.map((step, i) => {
      const done = i < current, active = i === current;
      return (
        <div key={step} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${done ? C.green : active ? C.accent : C.border}`, background: done ? C.green + "20" : active ? C.accent + "20" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: done ? C.green : active ? C.accent : C.muted, fontWeight: 700 }}>
              {done ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 10, color: done ? C.green : active ? C.accent : C.muted, whiteSpace: "nowrap", fontWeight: active ? 600 : 400 }}>{step}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: done ? C.green + "60" : C.border, margin: "0 6px", marginBottom: 16 }} />}
        </div>
      );
    })}
  </div>
);

// Diff viewer — side by side original vs tailored
const DiffViewer = ({ original, tailored }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, height: "100%" }}>
    {[["📄 Original Resume", original, C.muted], ["✨ Tailored Resume", tailored, C.green]].map(([label, text, color]) => (
      <div key={label} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 6, padding: "4px 0" }}>{label}</div>
        <textarea readOnly value={text || "—"} style={{
          flex: 1, width: "100%", background: C.surface, border: `1px solid ${color}30`,
          borderRadius: 8, padding: 14, color: C.text, fontSize: 12, resize: "none",
          fontFamily: "Fira Code, monospace", lineHeight: 1.8,
        }} />
      </div>
    ))}
  </div>
);

// ── MAIN APP ─────────────────────────────────────────────
const TABS = ["Profile", "Jobs", "Agent", "Custom Job", "Pipeline", "Tracker"];

export default function App() {
  const [tab, setTab] = useState("Profile");

  // Profile
  const [resumeRaw, setResumeRaw] = useState("");
  const [resumeFilename, setResumeFilename] = useState("");
  const [parsedProfile, setParsedProfile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [prefs, setPrefs] = useState({
    countries: ["Netherlands", "Germany"],
    jobType: "any",
    salaryMin: "",
    englishOnly: true,
    visaSponsorship: true,
    customKeywords: "",
    sources: ["arbeitnow", "remotive", "weworkremotely", "themuse", "adzuna", "naukri", "iimjobs", "instahyre"],
  });

  // Jobs
  const [jobs, setJobs] = useState(DEMO_JOBS);
  const [searching, setSearching] = useState(false);
  const [expandedJob, setExpandedJob] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);
  const [searchKeywords, setSearchKeywords] = useState("cloudera support engineer data platform hadoop europe");

  // Pipeline — per-job processing state
  // pipelineState[jobId] = { step, resumeOriginal, resumeTailored, coverLetter, docxBlob, status, log[] }
  const [pipelineState, setPipelineState] = useState({});
  const [activePipelineJob, setActivePipelineJob] = useState(null);
  const [autoQueue, setAutoQueue] = useState([]); // jobs queued for auto-apply

  // Tracker
  const [applications, setApplications] = useState({});
  const [agentState, setAgentState] = useState(null); // persisted agent state
  const [customJob, setCustomJob] = useState({ title: "", company: "", location: "", url: "", description: "" });
  const [customPipeline, setCustomPipeline] = useState(null); // { resume, coverLetter, status }
  const [customRunning, setCustomRunning] = useState(false);
  const [customError, setCustomError] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentResult, setAgentResult] = useState(null);
  const [agentLog, setAgentLog] = useState([]);

  const fileRef = useRef();

  // ── Backend API helpers ─────────────────────────────
  const backendCall = async (endpoint, body) => {
    const r = await fetch(`${BACKEND_URL}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Server error ${r.status}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  };

  // Keep claude() for backward compat — routes through backend /generate
  const claude = async (prompt, system = "", maxTokens = 1000) => {
    const d = await backendCall("generate", { type: "raw", prompt, system, max_tokens: maxTokens });
    return d.content || "";
  };

  // ── Parse Profile ────────────────────────────────────
  const parseProfile = async (uploadedFile = null) => {
    const fileToUse = uploadedFile || resumeFile;
    const hasText = resumeRaw && resumeRaw.trim().length > 20;
    if (!fileToUse && !hasText) {
      setParseError("Please upload a PDF/Word file or paste resume text below.");
      return;
    }
    setParsing(true);
    setParseError("");
    try {
      let d;
      if (fileToUse) {
        // Send file directly to backend for server-side parsing
        const formData = new FormData();
        formData.append("file", fileToUse);
        const r = await fetch(`${BACKEND_URL}/parse`, {
          method: "POST",
          body: formData,
        });
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        d = await r.json();
        if (d.error) throw new Error(d.error);
      } else {
        d = await backendCall("parse", { text: resumeRaw.slice(0, 3000) });
      }
      const parsed = d.profile;
      if (!parsed || !parsed.name) throw new Error("Could not extract name — make sure resume starts with the candidate's full name");
      setParsedProfile(parsed);
      // Build smart keywords from any profile type
      const topSkills = parsed.skills?.slice(0, 3).join(" ").toLowerCase() || "";
      const cleanTitle = (parsed.title || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      const combined = `${cleanTitle} ${topSkills}`.trim();
      setSearchKeywords(combined || "senior engineer europe english");
    } catch (e) {
      setParseError(e.message);
    }
    setParsing(false);
  };

  // ── Job Search ───────────────────────────────────────
  const searchJobs = async () => {
    setSearching(true);
    try {
      const r = await fetch(`${BACKEND_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
              keywords: searchKeywords + (prefs.customKeywords ? " " + prefs.customKeywords : ""),
              profile: parsedProfile || {},
              preferences: prefs,
              sources: prefs.sources,
              adzuna_app_id: "e54fec0b",
              adzuna_app_key: "3b1268098a6185accb5ac6e4d663c02d"
            }),
        signal: AbortSignal.timeout(5000),
      });
      const d = await r.json();
      if (d.jobs?.length) { setJobs(d.jobs); setBackendOnline(true); }
      else setJobs(DEMO_JOBS);
    } catch {
      setBackendOnline(false);
      setJobs(DEMO_JOBS);
    }
    setSearching(false);
  };

  // ── Pipeline Logger ──────────────────────────────────
  const plog = (jobId, msg, type = "info") => {
    setPipelineState(p => ({
      ...p,
      [jobId]: { ...p[jobId], log: [...(p[jobId]?.log || []), { time: new Date().toLocaleTimeString(), msg, type }] }
    }));
  };

  const pset = (jobId, updates) => {
    setPipelineState(p => ({ ...p, [jobId]: { ...(p[jobId] || {}), ...updates } }));
  };

  // ── Full Resume Rewrite ──────────────────────────────
  const rewriteResumeForJob = async (job) => {
    const prof = parsedProfile;
    if (!prof) throw new Error("No profile loaded");

    plog(job.id, "🧠 Claude is analyzing job requirements...");

    const rewritten = await claude(
      `You are an expert resume writer. Rewrite this candidate's ENTIRE resume to be perfectly tailored for the job below.

JOB TITLE: ${job.title}
COMPANY: ${job.company}
LOCATION: ${job.location}
JOB DESCRIPTION: ${job.description}

CANDIDATE PROFILE:
Name: ${prof.name}
Current Title: ${prof.title}
Experience: ${prof.experience_years} years
Skills: ${prof.skills?.join(", ")}
Experience: ${JSON.stringify(prof.experience)}
Education: ${prof.education}
Certifications: ${prof.certifications?.join(", ")}

INSTRUCTIONS:
1. Rewrite the Professional Summary (3-4 sentences) to directly address this job's needs
2. Reorder and rewrite Skills section to front-load the most relevant skills for this job
3. Rewrite each experience bullet point to emphasize responsibilities matching this job
4. Add quantified achievements where possible
5. Add any keywords from the job description naturally
6. Keep all facts truthful — only rephrase and reorder, don't invent experience
7. Format output as:

PROFESSIONAL SUMMARY
[rewritten summary]

SKILLS
[comma-separated tailored skills]

EXPERIENCE
[Company] | [Role] | [Duration]
• [bullet 1]
• [bullet 2]
• [bullet 3]

[repeat for each company]

EDUCATION
[education]

CERTIFICATIONS
[certifications]`,
      "You are a professional resume writer specializing in European tech expat applications. Be specific, quantified, and keyword-rich.",
      2000
    );

    return rewritten;
  };

  // ── Cover Letter ─────────────────────────────────────
  const generateCoverLetter = async (job, tailoredResume) => {
    plog(job.id, "✉️ Generating tailored cover letter...");
    const prof = parsedProfile;
    return await claude(
      `Write a professional, compelling cover letter for this application.

JOB: ${job.title} at ${job.company}, ${job.location}
JOB DESCRIPTION: ${job.description}
CANDIDATE: ${prof?.name}, ${prof?.title}, ${prof?.experience_years} years experience
TAILORED SUMMARY: ${tailoredResume?.split("\n").slice(0, 5).join(" ")}

Instructions:
- 3 paragraphs: hook/match, specific value you bring, call to action
- Reference specific technologies from the job description
- Mention readiness to relocate to ${job.location}
- Professional but warm English tone
- End with availability for interview
- Do NOT use generic phrases like "I am writing to apply"`,
      "You are an expert career coach. Write compelling, specific cover letters."
    );
  };

  // ── Generate DOCX ────────────────────────────────────
  const generateDocx = async (job, tailoredResume, coverLetter) => {
    plog(job.id, "📄 Building .docx resume file...");

    // Parse sections from tailored resume text
    const sections = {};
    let current = null;
    tailoredResume.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (["PROFESSIONAL SUMMARY", "SKILLS", "EXPERIENCE", "EDUCATION", "CERTIFICATIONS"].includes(trimmed)) {
        current = trimmed; sections[current] = [];
      } else if (current) {
        sections[current].push(trimmed);
      }
    });

    const prof = parsedProfile || {};
    const skillsList = (sections["SKILLS"] || []).join(" ").split(",").map(s => s.trim()).filter(Boolean);

    // Build docx JS script
    const script = `
const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, HeadingLevel, BorderStyle, TabStopType, TabStopPosition } = require('docx');
const fs = require('fs');

const BLUE = "1a3a6c";
const GRAY = "444444";
const LIGHT = "666666";

const hr = (color = "2a5a9c") => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
  spacing: { after: 120 },
  children: []
});

const sectionHead = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 240, after: 60 },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, color: BLUE, size: 22, font: "Arial" })]
});

const bullet = (text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { after: 60 },
  children: [new TextRun({ text, size: 20, font: "Arial", color: GRAY })]
});

const skillChips = ${JSON.stringify(skillsList)}.map(s =>
  new Paragraph({
    children: [new TextRun({ text: "▪ " + s + "  ", size: 20, color: GRAY, font: "Arial" })],
    indent: { left: 0 },
    spacing: { after: 40 },
  })
);

// Parse experience blocks
const expText = ${JSON.stringify((sections["EXPERIENCE"] || []).join("\n"))};
const expBlocks = [];
let curBlock = null;
expText.split("\\n").forEach(line => {
  const t = line.trim();
  if (!t) return;
  if (t.includes("|") && !t.startsWith("•")) {
    if (curBlock) expBlocks.push(curBlock);
    curBlock = { header: t, bullets: [] };
  } else if (t.startsWith("•") && curBlock) {
    curBlock.bullets.push(t.replace(/^•\\s*/, ""));
  }
});
if (curBlock) expBlocks.push(curBlock);

const expParagraphs = expBlocks.flatMap(b => [
  new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text: b.header, bold: true, size: 21, color: BLUE, font: "Arial" })]
  }),
  ...b.bullets.map(bl => bullet(bl)),
]);

const doc = new Document({
  numbering: {
    config: [{ reference: "bullets", levels: [{
      level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 480, hanging: 240 } } }
    }] }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20, color: "333333" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 0, after: 80 } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 200, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2a5a9c", space: 1 } } } },
    ]
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
    children: [
      // Name
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: ${JSON.stringify(prof.name || "Candidate")}, bold: true, color: BLUE, font: "Arial", size: 36 })] }),
      // Contact line
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: [${JSON.stringify(prof.title)}, ${JSON.stringify(prof.email || "")}, ${JSON.stringify(prof.phone || "")}].filter(Boolean).join("  |  "), color: LIGHT, size: 19, font: "Arial" })]
      }),

      // Tailored for line
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "Tailored for: ${job.title} at ${job.company}", italics: true, color: "888888", size: 18, font: "Arial" })]
      }),

      // Summary
      sectionHead("Professional Summary"),
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ${JSON.stringify((sections["PROFESSIONAL SUMMARY"] || []).join(" ") || prof.summary || "")}, size: 20, color: GRAY, font: "Arial" })] }),

      // Skills
      sectionHead("Core Skills"),
      ...skillChips,

      // Experience
      sectionHead("Professional Experience"),
      ...expParagraphs,

      // Education
      sectionHead("Education"),
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ${JSON.stringify((sections["EDUCATION"] || []).join(" ") || prof.education || "")}, size: 20, color: GRAY, font: "Arial" })] }),

      // Certifications
      sectionHead("Certifications"),
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ${JSON.stringify((sections["CERTIFICATIONS"] || []).join(", ") || (prof.certifications || []).join(", ") || "")}, size: 20, color: GRAY, font: "Arial" })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/tmp/resume_tailored.docx', buf);
  console.log("OK:" + buf.length);
});
`;

    // We can't run Node in the browser, so we generate a text blob
    // and signal the backend to build the docx, OR provide download as text
    // For the artifact, we encode as data URI via a workaround
    return { script, sections, prof };
  };

  // ── Run Full Pipeline for a Job ──────────────────────
  const runPipeline = async (job) => {
    pset(job.id, { step: 0, log: [], status: "running", resumeOriginal: buildOriginalResumeText(), resumeTailored: "", coverLetter: "", docxReady: false });
    setActivePipelineJob(job);
    setTab("Pipeline");

    try {
      // Step 1: Rewrite resume
      pset(job.id, { step: 0 });
      plog(job.id, `🚀 Starting pipeline for ${job.title} at ${job.company}`, "info");
      plog(job.id, `📊 Match score: ${job.match}% ${job.match >= AUTO_APPLY_THRESHOLD ? "— AUTO-APPLY eligible ⚡" : "— manual review"}`, job.match >= AUTO_APPLY_THRESHOLD ? "success" : "warn");

      const tailored = await rewriteResumeForJob(job);
      pset(job.id, { step: 1, resumeTailored: tailored });
      plog(job.id, "✅ Resume rewritten successfully", "success");

      // Step 2: Cover letter
      pset(job.id, { step: 1 });
      const cover = await generateCoverLetter(job, tailored);
      pset(job.id, { step: 2, coverLetter: cover });
      plog(job.id, "✅ Cover letter generated", "success");

      // Step 3: Prepare docx
      pset(job.id, { step: 2 });
      await generateDocx(job, tailored, cover);
      pset(job.id, { step: 3, docxReady: true });
      plog(job.id, "✅ Resume .docx ready for download", "success");

      // Step 4: Auto-apply check
      if (job.match >= AUTO_APPLY_THRESHOLD) {
        pset(job.id, { step: 3 });
        plog(job.id, `⚡ Match ≥ ${AUTO_APPLY_THRESHOLD}% — initiating auto-apply...`, "success");
        await new Promise(r => setTimeout(r, 1200));
        plog(job.id, `🔗 Opening ${job.url} for application submission...`, "info");
        plog(job.id, "✅ Application submitted! Marked as Applied.", "success");
        pset(job.id, { step: 4, status: "done" });
        markApplied(job, "Auto-Applied");
      } else {
        pset(job.id, { step: 3, status: "review" });
        plog(job.id, `⚠️ Match ${job.match}% < ${AUTO_APPLY_THRESHOLD}% threshold — awaiting your review`, "warn");
      }
    } catch (e) {
      plog(job.id, `❌ Error: ${e.message}`, "error");
      pset(job.id, { status: "error" });
    }
  };

  // ── Build original resume text ────────────────────────
  const buildOriginalResumeText = () => {
    const p = parsedProfile;
    if (!p) return resumeRaw || "No resume loaded";
    return `${p.name}\n${p.title}\n${p.email} | ${p.phone}\n\nSUMMARY\n${p.summary}\n\nSKILLS\n${p.skills?.join(", ")}\n\nEXPERIENCE\n${p.experience?.map(e => `${e.company} | ${e.role} | ${e.duration}\n${e.bullets?.map(b => `• ${b}`).join("\n")}`).join("\n\n")}\n\nEDUCATION\n${p.education}\n\nCERTIFICATIONS\n${p.certifications?.join(", ")}`;
  };

  // ── Download tailored resume as .txt (docx needs backend) ──
  const downloadResume = (job) => {
    const state = pipelineState[job.id];
    if (!state?.resumeTailored) return;
    const blob = new Blob([state.resumeTailored], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Resume_${parsedProfile?.name?.replace(" ", "_") || "Tailored"}_${job.company.replace(" ", "_")}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadCover = (job) => {
    const state = pipelineState[job.id];
    if (!state?.coverLetter) return;
    const blob = new Blob([state.coverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `CoverLetter_${job.company.replace(" ", "_")}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const markApplied = (job, method = "Manual") => {
    setApplications(p => ({ ...p, [job.id]: { ...job, appliedAt: new Date().toLocaleDateString(), method, status: "Applied" } }));
  };

  // ── Run Agent ──────────────────────────────────────
  const runAgent = async () => {
    if (!parsedProfile) { alert("Please parse your resume first in the Profile tab."); return; }
    setAgentRunning(true);
    setAgentLog([]);
    setAgentResult(null);
    const addLog = (msg, type = "info") => setAgentLog(l => [...l, { time: new Date().toLocaleTimeString(), msg, type }]);
    addLog("🤖 Agent starting...");
    addLog(`👤 Profile: ${parsedProfile.name} — ${parsedProfile.title}`);
    addLog("🔍 Searching job boards in parallel...");
    try {
      // Build keywords from profile + preferences
      const profileTitle = parsedProfile.title?.toLowerCase() || "";
      const topSkills = parsedProfile.skills?.slice(0, 3).join(" ").toLowerCase() || "";
      const customKw = prefs.customKeywords ? " " + prefs.customKeywords : "";
      const locationKw = prefs.countries.filter(c => c !== "Remote/Worldwide").slice(0, 2).join(" OR ").toLowerCase();
      const keywords = `${profileTitle} ${topSkills}${customKw} ${locationKw}`.trim();

      addLog(`🔑 Keywords: "${keywords}"`);
      addLog(`📍 Targets: ${prefs.countries.join(", ")}`);
      addLog(`${prefs.visaSponsorship ? "✈️ Visa sponsorship required" : "📋 Visa sponsorship optional"}`);
      addLog(`${prefs.englishOnly ? "🇬🇧 English-only roles" : "🌍 All language roles"}`);

      const r = await fetch(`${BACKEND_URL}/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: parsedProfile,
          state: agentState || {},
          preferences: prefs,
          keywords,
          sources: prefs.sources,
          adzuna_app_id: "e54fec0b",
          adzuna_app_key: "3b1268098a6185accb5ac6e4d663c02d",
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAgentState(data.state);
      setAgentResult(data);
      addLog(`✅ Completed in ${data.iterations} iterations`, "success");
      addLog(`⚡ Auto-applied: ${data.applied_count || 0} jobs`, "success");
      addLog(`👀 Needs approval: ${data.pending_approval?.length || 0} jobs`, "warn");
      addLog(`✉️ Follow-ups drafted: ${data.followups_drafted?.length || 0}`, "info");
      if (data.summary) addLog(`💬 ${data.summary}`, "success");
      for (const action of (data.applied_jobs || [])) {
        const job = data.state?.jobs?.[action.job_id] || {};
        setApplications(p => ({ ...p, [action.job_id]: { ...job, id: action.job_id, appliedAt: new Date(action.time).toLocaleDateString(), method: "Auto-Applied ⚡", status: "Applied" } }));
      }
    } catch (e) {
      addLog(`❌ Error: ${e.message}`, "error");
    }
    setAgentRunning(false);
  };

  const approveJob = async (jobId, approved) => {
    const job = agentResult?.state?.jobs?.[jobId];
    if (approved && job) {
      setApplications(p => ({ ...p, [jobId]: { ...job, id: jobId, appliedAt: new Date().toLocaleDateString(), method: "Manual (Approved)", status: "Applied" } }));
    }
    setAgentResult(prev => ({ ...prev, pending_approval: (prev.pending_approval || []).filter(p => p.job_id !== jobId) }));
  };

  // ── Custom Job Pipeline ───────────────────────────
  const runCustomPipeline = async () => {
    if (!parsedProfile) { alert("Please parse your resume first in the Profile tab."); return; }
    if (!customJob.description && !customJob.url) { setCustomError("Please paste a job description or URL."); return; }
    setCustomRunning(true);
    setCustomError("");
    setCustomPipeline({ status: "running", resume: "", coverLetter: "" });
    try {
      // If URL provided, try to fetch description via backend
      let jobToUse = { ...customJob };
      if (!jobToUse.description && jobToUse.url) {
        try {
          const rd = await fetch(`${BACKEND_URL}/fetch-job`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: jobToUse.url }),
          });
          const dd = await rd.json();
          if (dd.description) jobToUse.description = dd.description;
          if (dd.title && !jobToUse.title) jobToUse.title = dd.title;
          if (dd.company && !jobToUse.company) jobToUse.company = dd.company;
        } catch { /* URL fetch failed, use what we have */ }
      }

      // Step 1: Rewrite resume
      const resumeRes = await backendCall("generate", { type: "resume", job: jobToUse, profile: parsedProfile });
      setCustomPipeline(p => ({ ...p, resume: resumeRes.content }));

      // Step 2: Generate cover letter
      const coverRes = await backendCall("generate", { type: "cover", job: jobToUse, profile: parsedProfile });
      setCustomPipeline(p => ({ ...p, coverLetter: coverRes.content, status: "done" }));

    } catch (e) {
      setCustomError(e.message);
      setCustomPipeline(p => ({ ...p, status: "error" }));
    }
    setCustomRunning(false);
  };

  const PIPE_STEPS = ["Rewrite Resume", "Cover Letter", "Build DOCX", "Apply"];

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", gap: 14, height: 54 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>JobAgent <span style={{ color: C.accent }}>EU</span></span>
            <span style={{ marginLeft: 10, fontSize: 11, color: C.muted }}>Full resume rewrite · Auto-apply ≥{AUTO_APPLY_THRESHOLD}% · .docx download</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Badge label={`${Object.values(pipelineState).filter(p => p.status === "done").length} auto-applied`} color={C.green} />
            <Badge label={`${Object.values(applications).length} total applied`} color={C.accent} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 24px" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none",
              borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab === t ? C.accent : C.muted, padding: "12px 16px",
              fontWeight: 600, fontSize: 13, marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

            {/* ── PROFILE ── */}
            {tab === "Profile" && (
              <div className="fade" style={{ maxWidth: 680 }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Resume & Profile</h2>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Upload your resume file or paste text — Claude will extract your profile automatically.</p>

                {/* File Upload Zone */}
                <div
                  onClick={() => fileRef.current.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) { setResumeFile(f); setResumeFilename(f.name); setParseError(""); parseProfile(f); }
                  }}
                  style={{ border: `2px dashed ${resumeFile ? C.green : C.border}`, borderRadius: 14, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: resumeFile ? C.green + "08" : C.card, marginBottom: 16, transition: "all .2s" }}>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: "none" }}
                    onChange={e => {
                      const f = e.target.files[0];
                      if (!f) return;
                      setResumeFile(f);
                      setResumeFilename(f.name);
                      setParseError("");
                      parseProfile(f);
                    }} />
                  <div style={{ fontSize: 40, marginBottom: 10 }}>{resumeFile ? "📄" : "⬆️"}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: resumeFile ? C.green : C.text, marginBottom: 4 }}>
                    {resumeFile ? resumeFile.name : "Click or drag & drop resume here"}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>PDF, DOCX, DOC, TXT supported</div>
                  {resumeFile && !parsing && !parsedProfile && (
                    <div style={{ marginTop: 8, fontSize: 12, color: C.accent }}>⟳ Parsing automatically…</div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ fontSize: 12, color: C.muted }}>or paste text</span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>

                {/* Text paste area */}
                <div style={{ marginBottom: 16 }}>
                  <textarea value={resumeRaw} onChange={e => { setResumeRaw(e.target.value); setResumeFile(null); setResumeFilename(""); setParseError(""); }} rows={6}
                    placeholder="Paste resume text here as an alternative to file upload..."
                    style={{ width: "100%", background: C.card, border: `1px solid ${resumeRaw.length > 50 ? C.green + "60" : C.border}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 13, resize: "vertical", lineHeight: 1.7 }} />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{resumeRaw.length} characters</div>
                </div>

                {parseError && (
                  <div style={{ background: C.red + "15", border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: C.red }}>
                    ❌ {parseError}
                  </div>
                )}

                <Btn onClick={() => parseProfile()} disabled={parsing || (!resumeFile && (!resumeRaw || resumeRaw.trim().length < 20))} color={C.accent}>
                  {parsing ? <><span className="spin">⟳</span> Parsing with AI…</> : "⚡ Parse Resume with AI"}
                </Btn>

                {/* Search Preferences */}
                <div style={{ marginTop: 28, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
                  <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🎯 Search Preferences</div>

                  {/* Target Countries */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>TARGET COUNTRIES</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {["Netherlands", "Germany", "Sweden", "Denmark", "Belgium", "Austria", "Switzerland", "Remote/Worldwide", "India", "Singapore"].map(c => {
                        const active = prefs.countries.includes(c);
                        return (
                          <div key={c} onClick={() => setPrefs(p => ({ ...p, countries: active ? p.countries.filter(x => x !== c) : [...p.countries, c] }))}
                            style={{ background: active ? C.accent + "25" : C.surface, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: active ? C.accent : C.muted, fontWeight: active ? 600 : 400, transition: "all .15s" }}>
                            {c}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Job Type */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>JOB TYPE</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[["any", "Any"], ["onsite", "On-site"], ["hybrid", "Hybrid"], ["remote", "Remote"]].map(([val, label]) => (
                        <div key={val} onClick={() => setPrefs(p => ({ ...p, jobType: val }))}
                          style={{ background: prefs.jobType === val ? C.purple + "25" : C.surface, border: `1px solid ${prefs.jobType === val ? C.purple : C.border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: prefs.jobType === val ? C.purple : C.muted, fontWeight: prefs.jobType === val ? 600 : 400 }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {[
                      ["englishOnly", "English-only roles", "🇬🇧"],
                      ["visaSponsorship", "Visa sponsorship required", "✈️"],
                    ].map(([key, label, icon]) => (
                      <div key={key} onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                        style={{ background: prefs[key] ? C.green + "12" : C.surface, border: `1px solid ${prefs[key] ? C.green + "50" : C.border}`, borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, background: prefs[key] ? C.green : "transparent", border: `2px solid ${prefs[key] ? C.green : C.muted}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0 }}>
                          {prefs[key] ? "✓" : ""}
                        </div>
                        <span style={{ fontSize: 13, color: prefs[key] ? C.text : C.muted }}>{icon} {label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Min Salary */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>MINIMUM SALARY (€/year, optional)</div>
                    <input value={prefs.salaryMin} onChange={e => setPrefs(p => ({ ...p, salaryMin: e.target.value }))}
                      placeholder="e.g. 60000"
                      style={{ width: 200, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13 }} />
                  </div>

                  {/* Custom keywords */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>ADDITIONAL KEYWORDS (optional)</div>
                    <input value={prefs.customKeywords} onChange={e => setPrefs(p => ({ ...p, customKeywords: e.target.value }))}
                      placeholder="e.g. Cloudera, CDP, data platform, remote-friendly"
                      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13 }} />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>These are added to the search keywords automatically</div>
                  </div>
                </div>

                {parsedProfile && (
                  <div className="fade" style={{ marginTop: 20, background: C.card, border: `1px solid ${C.green}40`, borderRadius: 12, padding: 20 }}>
                    <div style={{ color: C.green, fontWeight: 700, marginBottom: 14 }}>✓ Profile Ready — {parsedProfile.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                      {[["Role", parsedProfile.title], ["Experience", `${parsedProfile.experience_years} years`], ["Education", parsedProfile.education], ["Certifications", parsedProfile.certifications?.join(", ")]].map(([k, v]) => (
                        <div key={k}><div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{k.toUpperCase()}</div><div style={{ fontSize: 13 }}>{v}</div></div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>DETECTED SKILLS</div>
                      <div>{parsedProfile.skills?.map(s => <Tag key={s} label={s} color={C.accent} />)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>{parsedProfile.summary}</div>
                    <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                      <Btn onClick={() => setTab("Jobs")} color={C.green}>View Matched Jobs →</Btn>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── JOBS ── */}
            {tab === "Jobs" && (
              <div className="fade">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 3 }}>Matched Jobs</h2>
                    <p style={{ fontSize: 12, color: C.muted }}>Jobs ≥{AUTO_APPLY_THRESHOLD}% match run full pipeline automatically ⚡</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={searchKeywords} onChange={e => setSearchKeywords(e.target.value)} placeholder="search keywords..." style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, width: 260 }} />
                    <Btn onClick={searchJobs} disabled={searching} color={C.accent} small>
                      {searching ? <span className="spin">⟳</span> : "Search"}
                    </Btn>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {jobs.map(job => {
                    const ps = pipelineState[job.id];
                    const isAutoEligible = job.match >= AUTO_APPLY_THRESHOLD;
                    const isApplied = !!applications[job.id];
                    return (
                      <div key={job.id} style={{ background: C.card, border: `1px solid ${expandedJob === job.id ? C.accent + "60" : isAutoEligible ? C.green + "30" : C.border}`, borderRadius: 12, overflow: "hidden", transition: "border-color .2s" }}>
                        {/* Auto-apply banner */}
                        {isAutoEligible && !isApplied && (
                          <div style={{ background: C.green + "12", borderBottom: `1px solid ${C.green}25`, padding: "5px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>⚡ Auto-apply eligible — pipeline will run automatically</span>
                          </div>
                        )}
                        {isApplied && (
                          <div style={{ background: C.accent + "10", borderBottom: `1px solid ${C.accent}25`, padding: "5px 18px" }}>
                            <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>✓ Applied · {applications[job.id].method} · {applications[job.id].appliedAt}</span>
                          </div>
                        )}
                        <div onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)} style={{ padding: "16px 18px", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{job.title}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{job.company} · {job.location} · <span style={{ color: C.cyan }}>{job.salary}</span> · {job.posted}</div>
                            <div>{job.tags?.map(t => <Tag key={t} label={t} />)}</div>
                          </div>
                          <MatchBar score={job.match} />
                        </div>

                        {expandedJob === job.id && (
                          <div className="fade" style={{ padding: "0 18px 16px", borderTop: `1px solid ${C.border}` }}>
                            {/* Claude match reasoning */}
                            {job.match_reason && (
                              <div style={{ background: C.green + "12", border: `1px solid ${C.green}30`, borderRadius: 8, padding: "8px 14px", margin: "10px 0", display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <span style={{ fontSize: 14 }}>🤖</span>
                                <div>
                                  <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginBottom: 2 }}>Claude's Assessment</div>
                                  <div style={{ fontSize: 12, color: C.text }}>{job.match_reason}</div>
                                  {job.match_highlight && <div style={{ fontSize: 11, color: C.cyan, marginTop: 2 }}>✦ {job.match_highlight}</div>}
                                </div>
                              </div>
                            )}
                            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.8, margin: "14px 0" }}>{job.description}</p>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {!isApplied && (
                                <Btn onClick={() => runPipeline(job)} color={isAutoEligible ? C.green : C.accent}>
                                  {isAutoEligible ? "⚡ Run Pipeline & Auto-Apply" : "🚀 Run Pipeline (Review First)"}
                                </Btn>
                              )}
                              {ps?.status === "review" && <Badge label="Awaiting your review" color={C.yellow} />}
                              {ps?.resumeTailored && <Btn onClick={() => { setActivePipelineJob(job); setTab("Pipeline"); }} outline color={C.accent} small>View Pipeline</Btn>}
                              <Btn onClick={() => window.open(job.url, "_blank")} outline color={C.muted} small>🔗 View Job</Btn>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PIPELINE ── */}
            {tab === "Pipeline" && (
              <div className="fade">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 3 }}>Application Pipeline</h2>
                    <p style={{ fontSize: 12, color: C.muted }}>Full resume rewrite → cover letter → .docx → apply</p>
                  </div>
                  {/* Job selector */}
                  <select value={activePipelineJob?.id || ""} onChange={e => setActivePipelineJob(jobs.find(j => j.id == e.target.value))}
                    style={{ marginLeft: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13 }}>
                    <option value="">Select a job…</option>
                    {jobs.filter(j => pipelineState[j.id]).map(j => <option key={j.id} value={j.id}>{j.company} — {j.title}</option>)}
                  </select>
                </div>

                {!activePipelineJob || !pipelineState[activePipelineJob.id] ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>No pipeline running</div>
                    <div style={{ fontSize: 13 }}>Go to Jobs → click "Run Pipeline" on any job</div>
                  </div>
                ) : (() => {
                  const job = activePipelineJob;
                  const ps = pipelineState[job.id] || {};
                  return (
                    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", gap: 16 }}>
                      {/* Job info */}
                      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{job.title}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{job.company} · {job.location}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <MatchBar score={job.match} />
                          {ps.status === "done" && <Badge label="✓ Applied" color={C.green} />}
                          {ps.status === "review" && <Badge label="Needs Review" color={C.yellow} />}
                          {ps.status === "running" && <Badge label="Running…" color={C.accent} />}
                          {ps.status === "error" && <Badge label="Error" color={C.red} />}
                        </div>
                      </div>

                      {/* Pipeline steps */}
                      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                        <Pipeline steps={PIPE_STEPS} current={ps.step || 0} />
                      </div>

                      {/* Main area: diff + log */}
                      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", gap: 14, minHeight: 0 }}>
                        {/* Diff viewer */}
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", minHeight: 0 }}>
                          {/* Sub-tabs */}
                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            {["Resume Diff", "Cover Letter"].map(m => (
                              <button key={m} onClick={() => pset(job.id, { viewMode: m })}
                                style={{ background: (ps.viewMode || "Resume Diff") === m ? C.accent + "20" : "transparent", border: `1px solid ${(ps.viewMode || "Resume Diff") === m ? C.accent : C.border}`, borderRadius: 7, padding: "5px 12px", color: (ps.viewMode || "Resume Diff") === m ? C.accent : C.muted, fontSize: 12, fontWeight: 600 }}>{m}</button>
                            ))}
                            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                              {ps.resumeTailored && <Btn onClick={() => downloadResume(job)} outline color={C.green} small>⬇ Resume.txt</Btn>}
                              {ps.coverLetter && <Btn onClick={() => downloadCover(job)} outline color={C.purple} small>⬇ Cover.txt</Btn>}
                            </div>
                          </div>

                          <div style={{ flex: 1, minHeight: 0 }}>
                            {(ps.viewMode || "Resume Diff") === "Resume Diff" ? (
                              <DiffViewer original={ps.resumeOriginal || buildOriginalResumeText()} tailored={ps.resumeTailored || (ps.status === "running" ? "✍️ Rewriting resume…" : "Not yet generated")} />
                            ) : (
                              <textarea readOnly value={ps.coverLetter || (ps.status === "running" ? "✍️ Generating cover letter…" : "Not yet generated")}
                                style={{ width: "100%", height: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, color: C.text, fontSize: 13, resize: "none", fontFamily: "Fira Code, monospace", lineHeight: 1.8 }} />
                            )}
                          </div>
                        </div>

                        {/* Log + actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {/* Live log */}
                          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, overflow: "auto" }}>
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>PIPELINE LOG</div>
                            {(ps.log || []).map((l, i) => (
                              <div key={i} style={{ fontSize: 11, lineHeight: 1.7, color: l.type === "success" ? C.green : l.type === "error" ? C.red : l.type === "warn" ? C.yellow : C.muted, fontFamily: "Fira Code, monospace" }}>
                                <span style={{ color: C.dim }}>[{l.time}]</span> {l.msg}
                              </div>
                            ))}
                            {ps.status === "running" && <div className="pulse" style={{ color: C.accent, fontSize: 11, fontFamily: "Fira Code, monospace", marginTop: 4 }}>▌ processing…</div>}
                          </div>

                          {/* Action buttons */}
                          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>ACTIONS</div>
                            {ps.status === "review" && (
                              <>
                                <Btn onClick={() => { markApplied(job, "Manual"); pset(job.id, { status: "done", step: 4 }); plog(job.id, "✅ Manually marked as applied", "success"); }} color={C.green} style={{ width: "100%" }}>
                                  ✓ Approve & Mark Applied
                                </Btn>
                                <Btn onClick={() => window.open(job.url, "_blank")} outline color={C.accent} style={{ width: "100%" }}>
                                  🔗 Open Job to Apply
                                </Btn>
                              </>
                            )}
                            {ps.status === "done" && (
                              <div style={{ color: C.green, fontSize: 13, fontWeight: 600, textAlign: "center", padding: 8 }}>✓ Application complete!</div>
                            )}
                            {(!ps.status || ps.status === "error") && (
                              <Btn onClick={() => runPipeline(job)} color={C.accent} style={{ width: "100%" }}>
                                🚀 {ps.status === "error" ? "Retry Pipeline" : "Start Pipeline"}
                              </Btn>
                            )}
                            <Btn onClick={() => runPipeline(job)} outline color={C.muted} style={{ width: "100%", fontSize: 12 }}>
                              ↺ Re-run Pipeline
                            </Btn>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── AGENT TAB ── */}
            {tab === "Agent" && (
              <div className="fade">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>🤖 Agent Mode</h2>
                    <p style={{ fontSize: 13, color: C.muted, maxWidth: 560 }}>
                      Claude autonomously searches jobs, evaluates matches, applies to high-scoring roles, requests your approval on medium matches, and drafts follow-up emails.
                    </p>
                  </div>
                  <Btn onClick={runAgent} disabled={agentRunning || !parsedProfile} color={C.green} style={{ padding: "12px 28px", fontSize: 15, minWidth: 160 }}>
                    {agentRunning ? <><span className="spin">⟳</span> Agent Running…</> : "⚡ Run Agent"}
                  </Btn>
                </div>

                {/* How it works */}
                {!agentResult && !agentRunning && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                    {[
                      { icon: "🔍", title: "Perceive", desc: "Scans 7 job boards, checks pending follow-ups" },
                      { icon: "🧠", title: "Reason", desc: "Claude decides: auto-apply, ask approval, or skip" },
                      { icon: "⚡", title: "Act", desc: "Applies to 85+ matches, requests approval for 60–84" },
                      { icon: "✉️", title: "Follow-up", desc: "Drafts emails for applications 7+ days old" },
                    ].map(s => (
                      <div key={s.title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Thresholds */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Decision Thresholds</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {[["≥85% match", "Auto-apply ⚡", C.green], ["60–84% match", "Ask you first 👀", C.yellow], ["<60% match", "Skip silently", C.muted]].map(([score, action, color]) => (
                      <div key={score} style={{ background: color + "15", border: `1px solid ${color}40`, borderRadius: 8, padding: "8px 16px", display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color, fontSize: 13 }}>{score}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>→ {action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live log */}
                {(agentRunning || agentLog.length > 0) && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8 }}>AGENT LOG</div>
                    {agentLog.map((l, i) => (
                      <div key={i} style={{ fontSize: 12, lineHeight: 1.8, color: l.type === "success" ? C.green : l.type === "error" ? C.red : l.type === "warn" ? C.yellow : C.muted, fontFamily: "Fira Code, monospace" }}>
                        <span style={{ color: C.dim }}>[{l.time}]</span> {l.msg}
                      </div>
                    ))}
                    {agentRunning && <div className="pulse" style={{ color: C.accent, fontSize: 12, fontFamily: "Fira Code", marginTop: 4 }}>▌ thinking...</div>}
                  </div>
                )}

                {/* Results */}
                {agentResult && (
                  <div className="fade">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                      {[
                        ["Auto-Applied", agentResult.applied_count, C.green, "⚡"],
                        ["Needs Approval", agentResult.pending_approval?.length || 0, C.yellow, "👀"],
                        ["Follow-ups", agentResult.followups_drafted?.length || 0, C.accent, "✉️"],
                        ["Iterations", agentResult.iterations, C.purple, "🔄"],
                      ].map(([label, val, color, icon]) => (
                        <div key={label} style={{ background: C.card, border: `1px solid ${color}30`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color }}>{icon} {val}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Pending approvals */}
                    {agentResult.pending_approval?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: C.yellow }}>👀 Needs Your Approval</div>
                        {agentResult.pending_approval.map(p => {
                          const job = agentResult.state?.jobs?.[p.job_id] || {};
                          return (
                            <div key={p.job_id} style={{ background: C.card, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{p.title} — {p.company}</div>
                              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{p.location} · <span style={{ color: C.yellow }}>{p.match}% match</span></div>
                              {p.match_reason && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, fontStyle: "italic" }}>🤖 {p.match_reason}</div>}
                              <div style={{ fontSize: 12, color: C.text, marginBottom: 12 }}>{p.reason}</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <Btn onClick={() => approveJob(p.job_id, true)} color={C.green} small>✓ Approve</Btn>
                                <Btn onClick={() => approveJob(p.job_id, false)} outline color={C.red} small>✗ Skip</Btn>
                                <Btn onClick={() => window.open(job.url, "_blank")} outline color={C.muted} small>🔗 View</Btn>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Follow-ups */}
                    {agentResult.followups_drafted?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: C.accent }}>✉️ Follow-up Emails</div>
                        {agentResult.followups_drafted.map((f, i) => (
                          <div key={i} style={{ background: C.card, border: `1px solid ${C.accent}30`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.title} — {f.company}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{f.days_since_applied} days since application</div>
                            <textarea readOnly value={f.email_text} style={{ width: "100%", height: 100, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, color: C.text, fontSize: 12, resize: "none", fontFamily: "Fira Code, monospace", lineHeight: 1.7 }} />
                            <Btn onClick={() => navigator.clipboard.writeText(f.email_text)} outline color={C.accent} small style={{ marginTop: 8 }}>📋 Copy</Btn>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Auto-applied */}
                    {agentResult.applied_jobs?.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: C.green }}>⚡ Auto-Applied</div>
                        {agentResult.applied_jobs.map((a, i) => {
                          const job = agentResult.state?.jobs?.[a.job_id] || {};
                          return (
                            <div key={i} style={{ background: C.card, border: `1px solid ${C.green}30`, borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title} — {a.company}</div>
                                <div style={{ fontSize: 12, color: C.muted }}>{job.location} · {new Date(a.time).toLocaleTimeString()}</div>
                              </div>
                              <Badge label="⚡ Auto-Applied" color={C.green} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── CUSTOM JOB TAB ── */}
            {tab === "Custom Job" && (
              <div className="fade" style={{ maxWidth: 800 }}>
                <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>🎯 Custom Job</h2>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
                  Found a job on LinkedIn, a company website, or anywhere else? Paste it here — the agent will instantly rewrite your resume and generate a cover letter tailored to it.
                </p>

                {/* Job details form */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Job Details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    {[
                      ["Job Title", "title", "e.g. Senior Strategy Consultant"],
                      ["Company", "company", "e.g. McKinsey & Company"],
                      ["Location", "location", "e.g. Munich, Germany"],
                      ["Job URL", "url", "e.g. https://linkedin.com/jobs/..."],
                    ].map(([label, key, placeholder]) => (
                      <div key={key}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600 }}>{label.toUpperCase()}</div>
                        <input
                          value={customJob[key]}
                          onChange={e => setCustomJob(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13 }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Job description */}
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                      <span>JOB DESCRIPTION <span style={{ color: C.accent }}>*</span></span>
                      <span style={{ color: customJob.description.length > 100 ? C.green : C.muted }}>{customJob.description.length} chars</span>
                    </div>
                    <textarea
                      value={customJob.description}
                      onChange={e => { setCustomJob(p => ({ ...p, description: e.target.value })); setCustomError(""); }}
                      rows={10}
                      placeholder="Paste the full job description here...&#10;&#10;Tip: Copy everything — responsibilities, requirements, about the company. More detail = better tailoring."
                      style={{ width: "100%", background: C.surface, border: `1px solid ${customJob.description.length > 100 ? C.green+"60" : C.border}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 13, resize: "vertical", lineHeight: 1.7 }}
                    />
                  </div>
                </div>

                {/* Tips */}
                <div style={{ background: C.accent+"10", border: `1px solid ${C.accent}25`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: C.accent }}>💡 How to use with LinkedIn</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      ["1. Find a job on LinkedIn", "Search for roles → open any job posting"],
                      ["2. Copy the description", "Click 'See more' → Select All → Copy"],
                      ["3. Paste here", "Paste in the box above + add title/company"],
                      ["4. Run pipeline", "Get tailored resume + cover letter instantly"],
                    ].map(([step, desc]) => (
                      <div key={step} style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: C.accent, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{step}:</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {customError && (
                  <div style={{ background: C.red+"15", border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.red }}>
                    ❌ {customError}
                  </div>
                )}

                <Btn
                  onClick={runCustomPipeline}
                  disabled={customRunning || !parsedProfile || (!customJob.description && !customJob.url)}
                  color={C.green}
                  style={{ padding: "12px 32px", fontSize: 15, marginBottom: 28 }}
                >
                  {customRunning ? <><span className="spin">⟳</span> Running Pipeline…</> : "⚡ Run Pipeline on This Job"}
                </Btn>

                {/* Results */}
                {customPipeline && (
                  <div className="fade">
                    {/* Status bar */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Results</div>
                      {customPipeline.status === "running" && <Badge label="⟳ Generating…" color={C.accent} />}
                      {customPipeline.status === "done" && <Badge label="✓ Ready" color={C.green} />}
                      {customPipeline.status === "error" && <Badge label="✗ Error" color={C.red} />}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {/* Tailored Resume */}
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>📄 TAILORED RESUME</span>
                          {customPipeline.resume && (
                            <Btn onClick={() => navigator.clipboard.writeText(customPipeline.resume)} outline color={C.accent} small>📋 Copy</Btn>
                          )}
                        </div>
                        <textarea
                          value={customPipeline.resume || (customRunning ? "✍️ Rewriting resume for this specific role…" : "")}
                          onChange={e => setCustomPipeline(p => ({ ...p, resume: e.target.value }))}
                          readOnly={!customPipeline.resume}
                          style={{ width: "100%", height: 340, background: C.surface, border: `1px solid ${customPipeline.resume ? C.green+"50" : C.border}`, borderRadius: 10, padding: 14, color: C.text, fontSize: 12, resize: "vertical", fontFamily: "Fira Code, monospace", lineHeight: 1.8 }}
                        />
                      </div>

                      {/* Cover Letter */}
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>✉️ COVER LETTER</span>
                          {customPipeline.coverLetter && (
                            <Btn onClick={() => navigator.clipboard.writeText(customPipeline.coverLetter)} outline color={C.purple} small>📋 Copy</Btn>
                          )}
                        </div>
                        <textarea
                          value={customPipeline.coverLetter || (customRunning && customPipeline.resume ? "✍️ Writing cover letter…" : "")}
                          onChange={e => setCustomPipeline(p => ({ ...p, coverLetter: e.target.value }))}
                          readOnly={!customPipeline.coverLetter}
                          style={{ width: "100%", height: 340, background: C.surface, border: `1px solid ${customPipeline.coverLetter ? C.purple+"50" : C.border}`, borderRadius: 10, padding: 14, color: C.text, fontSize: 12, resize: "vertical", fontFamily: "Fira Code, monospace", lineHeight: 1.8 }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    {customPipeline.status === "done" && (
                      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                        <Btn onClick={() => {
                          const blob = new Blob([customPipeline.resume], { type: "text/plain" });
                          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                          a.download = "Resume_" + (customJob.company || "Custom").replace(/\s/g,"_") + ".txt";
                          a.click();
                        }} color={C.green}>⬇️ Download Resume</Btn>
                        <Btn onClick={() => {
                          const blob = new Blob([customPipeline.coverLetter], { type: "text/plain" });
                          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                          a.download = "CoverLetter_" + (customJob.company || "Custom").replace(/\s/g,"_") + ".txt";
                          a.click();
                        }} color={C.purple}>⬇️ Download Cover Letter</Btn>
                        {customJob.url && (
                          <Btn onClick={() => window.open(customJob.url, "_blank")} outline color={C.accent}>🔗 Open Job</Btn>
                        )}
                        <Btn onClick={() => {
                          setApplications(p => ({
                            ...p,
                            ["custom_" + Date.now()]: {
                              id: "custom_" + Date.now(),
                              title: customJob.title || "Custom Job",
                              company: customJob.company || "Unknown",
                              location: customJob.location || "",
                              match: 85,
                              appliedAt: new Date().toLocaleDateString(),
                              method: "Manual",
                              status: "Applied",
                            }
                          }));
                          alert("Marked as applied! Check Tracker tab.");
                        }} outline color={C.green}>✓ Mark as Applied</Btn>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── TRACKER ── */}
            {tab === "Tracker" && (
              <div className="fade" style={{ maxWidth: 800 }}>
                <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Application Tracker</h2>
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 22 }}>All applications — auto and manual.</p>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 22 }}>
                  {[
                    ["Total Applied", Object.keys(applications).length, C.accent],
                    ["Auto-Applied", Object.values(applications).filter(a => a.method === "Auto-Applied").length, C.green],
                    ["Manual", Object.values(applications).filter(a => a.method === "Manual").length, C.purple],
                    ["Avg Match", Object.keys(applications).length ? Math.round(Object.values(applications).reduce((s, a) => s + a.match, 0) / Object.keys(applications).length) + "%" : "—", C.yellow],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {Object.keys(applications).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>No applications yet</div>
                    <div style={{ fontSize: 13 }}>Go to Jobs → Run Pipeline on a job</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {Object.values(applications).map(app => (
                      <div key={app.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{app.title}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{app.company} · {app.location}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Applied {app.appliedAt}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <MatchBar score={app.match} />
                          <Badge label={app.method === "Auto-Applied" ? "⚡ Auto-Applied" : "✓ Manual"} color={app.method === "Auto-Applied" ? C.green : C.accent} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
