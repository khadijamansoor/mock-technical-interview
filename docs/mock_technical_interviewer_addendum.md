# Mock Technical Interviewer — Addendum (Consolidated)

## Why this addendum exists

The original brief assumed Docker-based local dev and scoped three interview tracks with no video/voice-analysis features. Since then: a hardware blocker forced a Docker-free dev workflow, and a client conversation added scope — webcam-based coaching, Groq-native live voice, session-integrity nudges, sharper market positioning, and a much larger track taxonomy. This doc captures all of it in one place so there's a single source of truth for Antigravity to build against.

---

## PART A — Dev Environment & Tooling

### Updated Local Dev Setup (No Docker)

Local development runs natively — no containers, no virtualization required.

1. **Database (local dev only):** A free cloud Postgres instance via **Supabase or Neon**, with pgvector already enabled out of the box. Connection string goes in `.env` as `DATABASE_URL`. No local Postgres install needed.
2. **Web app (`web` service):** Standard `npm install` → `npm run dev` in a terminal. Runs the Next.js app exactly as it would in any environment.
3. **Grading app (`grading` service):** Python installed locally, `flask run` in a second terminal. Talks to the same Supabase/Neon `DATABASE_URL`.
4. **Service-to-service calls (local):** In production, `web` reaches `grading` over Railway's private internal network. Locally, there is no such network — `web` just calls `grading` directly at `http://localhost:<port>` (whatever Flask is running on), set via `GRADING_SERVICE_URL` in `.env`. This is a plain HTTP call, not a special local-network simulation.

**This changes nothing about the production deployment plan in the original brief** — Railway builds and deploys from the repo regardless of whether Docker was used locally.

### Database: Split by Environment (Decision Made)

- **Local dev:** Supabase or Neon (cloud Postgres + pgvector), used purely for convenience during development.
- **Production:** Railway's own PostgreSQL plugin (+ pgvector extension via migration), as originally planned in the brief — same project, same internal network, same dashboard as the `web` and `grading` services.

**Implication:** the DB schema/migrations need to run cleanly against both Supabase/Neon (dev) and Railway Postgres (prod) — standard Postgres + pgvector SQL, so this should be a non-issue as long as we avoid any Supabase/Neon-proprietary features. Keep migrations in plain SQL files (not a Supabase-specific CLI) so they port cleanly to Railway.

### Dev Tooling: Google Antigravity — Full Use, With Manual Review

Google Antigravity (Google's agent-first IDE, Gemini-based) is used to build the whole project, including the core pieces: the interview state machine, the Groq integration/live conversational turn logic, the follow-up decision loop, and everything else including the newer features below.

**The safeguard is manual review, not scope restriction.** Every piece Antigravity generates gets checked and adjusted by hand until it matches the actual intended design — not accepted as-is. The goal is still to be able to explain and defend every design decision personally in an interview; that's achieved by reviewing and understanding the generated code line-by-line rather than by keeping the agent away from core logic.

---

## PART B — Feature Expansion

### B1. Webcam Coaching (Nonverbal Feedback) — Not Scoring

**What it is:** Client-side analysis of eye contact, head-pose stability, and posture during a session, surfaced as coaching feedback.

**What it explicitly is NOT:** A scored rubric dimension, and not framed as "what a real interviewer sees." This distinction matters — HireVue built and later abandoned facial-expression scoring in hiring after an FTC complaint and bias criticism; their own data showed nonverbal signal contributed roughly 0.25–4% to predictive power. That precedent is about scoring real candidates for real hiring decisions, a different risk profile than coaching someone practicing — but the *positioning* still has to stay firmly on the coaching side of that line.

**Architecture:**
- Capture via browser `getUserMedia()`.
- Analysis runs **entirely client-side** via MediaPipe Face Landmarker + Pose Landmarker (`@mediapipe/tasks-vision`, WASM/WebGL, no server round-trip).
- Only **derived metrics** (small JSON per turn — eye-contact ratio, head-pose stability, posture shifts) cross the network. Raw video never leaves the browser unless the user explicitly opts to save a local clip.
- Metrics feed into the existing `grading` service call at `SESSION_END`, same pattern as the transcript.

**Schema change:** Add `nonverbal_metrics` (jsonb) to `Turn`. Fold into the existing Communication rubric dimension, or add a distinct "Presence" dimension — decide per track (see B5).

**Compliance, non-optional:**
- Explicit consent screen before webcam activation — plain-language statement of what's analyzed and why.
- No server-side video retention by default. If clip playback is added later, that's new object-storage scope (Railway has no built-in blob storage — would need Cloudflare R2 or Supabase Storage) and should be flagged as added scope, not bundled in silently.
- Some US states (Illinois' BIPA in particular) regulate facial-geometry-*derived* data, not just raw scans, with steep per-violation statutory damages. Consent + minimal retention is the practical mitigation.

### B2. Groq-Native Live Voice

**Update to the original brief's v2 voice plan:** Groq now offers native Whisper STT (~80ms) and its own TTS endpoint (Orpheus/PlayAI) alongside the LLM inference already in use — a full STT→LLM→TTS pipeline can run Groq-native end-to-end at roughly ~380ms, comfortably inside the range that reads as a natural, live conversational pace.

**Transport:** Groq's own docs point to LiveKit for the WebRTC layer (pairing Groq STT with LiveKit's transport/TTS handling). There's an official Groq voice-agent GitHub template — configurable models, multiple TTS voices, conversation history — usable as a scaffold rather than building the real-time transport from scratch.

**What this does NOT change:** The MVP's SSE token streaming stays as-is — it's one-directional and sufficient for the text-based v1. Full duplex (candidate interrupting the AI mid-sentence, the actual "seamless" feel) needs bidirectional streaming, which means WebSockets — already correctly scoped as v2 in the original brief. This section confirms the tech is ready when that phase starts; it doesn't pull the timeline forward.

**Open decision to make later:** Groq-native TTS (simpler, one vendor, likely lower latency) vs. ElevenLabs (generally more natural-sounding voices). Real tradeoff, not a default pick.

### B3. Session Integrity ("Focus Mode") — Reuses the Same Pipeline

**Reframe from "anti-cheating security" to integrity nudges.** This product isn't screening candidates for an employer — it's self-practice. If a user pastes an AI-generated answer, they're only undermining their own practice value. Hard proctoring (browser lockdown, aggressive flags) reads as distrust and is a worse product decision than a soft nudge.

**Mechanics — all additive to work already scoped in B1, no new subsystem:**
- Gaze-off-screen duration/frequency — same MediaPipe eye/iris landmarks already extracted for coaching, different downstream metric.
- Tab/window blur — Page Visibility API, client-side, near-zero cost.
- Paste detection on answer input — flag, don't block.
- Second-face-in-frame — free byproduct of the existing face-landmark pipeline.
- Response-timing anomalies — compare cadence against the session's own baseline.

**UX:** Soft on-screen nudge ("looks like you switched tabs — want to restart this question?"), not a penalty or hard score. Reuses `Turn.eval_json`; no new data model needed beyond what B1 already adds.

**Note on "eye tracking" precision:** Webcam-based gaze estimation (iris position + head yaw/pitch, derived from MediaPipe's face mesh) gives *direction* — on-screen vs. off-screen — not pixel-level "which word are they reading." That's the industry-standard ceiling for consumer webcams without dedicated hardware, and it's sufficient for both the coaching and integrity use cases above.

### B4. Market Positioning — Where This Product Actually Differentiates

The current market is fragmented by design: candidates are routinely advised to stack 3–4 separate tools (a question bank, live human mock interviews, peer practice, and a delivery coach) because no single platform covers everything. That fragmentation is the wedge — this product's architecture (Groq live conversation + Python/pgvector grading + webcam coaching, all already planned) is unusually well-positioned to be the "one tool" rather than one more narrow specialist.

**Two differentiators worth building in deliberately, not as afterthoughts:**

1. **Hiring-manager-calibrated rubrics, not generic praise.** Generic LLM feedback tends toward "great answer!" regardless of actual quality — at least one competitor markets explicitly against this. The existing `grading` service's structured rubric approach is the right foundation; the differentiator is keeping each track's rubric honest and weighted the way real hiring committees actually weight things (see B5), rather than a flattering average.

2. **Adaptive weak-point targeting across sessions.** The original brief has "progress analytics" as a v2 item — worth sharpening now: after each session, identify the worst-scoring rubric dimension and generate the *next* session's questions to specifically stress-test that gap. This is a real gap in the current market (competitors show trend lines at best) and is a strong, specific answer to "why this over stacking three other tools."

### B5. Expanded Track Taxonomy

The original three tracks (frontend/backend/system-design) are too flat. Real interview loops mix **tracks** (job function) with **round types** (interview format), and those don't collapse into one field.

**Technical tracks:**
- Coding / DSA
- System design (HLD)
- Low-level design / OOD (distinct skill from HLD — often a separate round)
- SQL & database design
- ML / Data Science — split into ML coding, ML system design, stats/probability (often three distinct rounds)
- DevOps / SRE — incident response, infra design
- Data Engineering — pipeline/ETL design
- Security / AppSec
- QA / Testing strategy

**Non-engineering, technical-adjacent:**
- Product Management — product sense, execution/metrics, case-strategy (again, often three separate rounds)
- Engineering Management — org design, conflict-resolution scenarios
- Data Analyst — SQL + business-case hybrid
- UX / Design — portfolio walkthrough critique

**Cross-cutting (apply to any track):**
- Behavioral / STAR
- Case interview (consulting-style structured problem solving)
- Salary negotiation simulation — genuinely underserved in the current market, and a natural "after you get the offer" feature

**Schema changes:**
- Add `round_type` field to `Question` (alongside existing `topic`).
- **`Scorecard` rubric weights must vary per track**, not use one fixed table — a PM case-interview rubric (structure, creativity, quant reasoning, communication) looks nothing like a DSA rubric (correctness, complexity, edge cases). Model this now rather than retrofitting later.

**Rollout guidance:** Don't launch all tracks at once. Ship 2–3 tracks that exercise the full pipeline well (Coding + System Design + Behavioral is a reasonable first slice), with genuinely sharp per-track rubrics, then expand track-by-track on the same schema. Breadth without depth reads as thin — several competitor reviews explicitly criticize exactly that failure mode.

---

## Consolidated Summary Table

| Layer / Addition | Choice / Approach | New infra? |
|---|---|---|
| Frontend + orchestration | Next.js (standalone Node server), SSE streaming (MVP) | — |
| Live conversational AI | Groq API, called directly from Next.js | — |
| Grading service | Python/Flask, called internally from Next.js | — |
| Local dev database | Supabase or Neon (pgvector pre-enabled) | — |
| Production database | Railway PostgreSQL plugin (+ pgvector) | — |
| Local dev workflow | No Docker — `npm run dev` + `flask run` in separate terminals | — |
| Dev tooling | Antigravity for everything; all output manually reviewed and adjusted | — |
| Webcam coaching (eye contact, posture) | Client-side MediaPipe → `grading` at session end | New `Turn.nonverbal_metrics` field only |
| Groq-native live voice | `web` service, v2 phase | LiveKit (WebRTC transport); Groq STT/TTS endpoints |
| Session integrity / focus mode | Client-side, reuses coaching pipeline | None — same MediaPipe pipeline, new derived metrics |
| Hiring-manager-calibrated rubrics | `grading` service, per-track weighting | Schema: per-track `Scorecard` weights |
| Adaptive weak-point targeting | `grading` + question selection logic | Uses existing pgvector question bank |
| Expanded track taxonomy | `Question`, `Scorecard` | New `round_type` field on `Question` |
