---
name: literature-review
description: "Conduct a structured literature review with iterative search, deep paper analysis, code inspection, verification, and synthesis. Use when: (1) Researching a topic systematically across academic papers, (2) Building an evidence base for a task or project, (3) Comparing approaches/methods with honest assessment. The agent investigates context from the task system first, then collaborates with the user to plan the review."
---

# Literature Review Skill

This skill orchestrates a multi-phase literature review using subagents. It is **goal-driven** — the agent investigates context, reasons about what the user needs, and adapts the approach accordingly.

The body below is a phase-by-phase overview. Each phase has a companion file in `references/` with the detailed workflow (prompt templates, output schemas, edge cases). **Read the referenced file for the phase you are currently executing** — don't try to run a phase from this overview alone.

## Tools for this skill

| Tool | What it does |
|------|-------------|
| `mcp__arxiv-search__search_papers` | Semantic search across paper titles, abstracts, authors. Returns metadata: title, abstract, year, venue, citation count, fields, PDF URL. |
| `mcp__arxiv-search__download_paper` | Downloads paper PDFs and converts to Markdown. Accepts single URL or list of URLs for batch processing. Default output: `arxiv_search/papers/`. |
| Task tool with `paper-analyzer` subagent | Reads a paper markdown file, produces structured 5-section summary with query-specific findings. Grounded only in provided text. |
| Task tool with `general-purpose` subagent | General-purpose agent for screening batches of papers and verification tasks. |
| Task tool with `Explore` subagent | Explores codebases — architecture, patterns, file structure. |

## Workflow overview

### Phase 0 — Understand the goal
Investigate task context (active task, parent, deps, siblings, existing literature artifacts), then converse with the user to confirm the goal, specific questions, output format, and scope. Propose a plan; wait for user confirmation; save `review_brief.md`.
→ **See `references/phase_0_goal.md` for the full workflow, including context-investigation steps, the conversation template, output format options, and the `review_brief.md` template.**

### Phase 1 — Iterative search
Search aggressively for high recall. Run searches in rounds, saving each round's results to `search_results/round_N_<strategy>.md` via the `output_file` parameter. Rounds: (1) direct queries in parallel, (2) survey discovery, (3) terminology expansion, (4+) snowball + gap-filling. Stop when 3 consecutive rounds produce no new relevant candidates. Compile `search_log.md`.
→ **See `references/phase_1_search.md` for per-round query strategies, the `output_file` pattern, and the search-log template.**

### Phase 2 — Screening
Screen candidates for **utility to the user's goal**, not just topic relevance. Spawn a `general-purpose` subagent pointed at `review_brief.md` + all search-result files; it produces `screened_papers.md` with INCLUDE / BORDERLINE / EXCLUDE rationale and a coverage assessment. Present results to the user and update with their decisions on borderline papers.
→ **See `references/phase_2_screening.md` for the subagent prompt, scoring rubric, output table schema, and user-presentation template.**

### Phase 3 — Deep analysis
Batch-download included papers. For each paper, craft an **elaborate, per-paper** `user_query` for the `paper-analyzer` subagent — adapt the template to the paper type (methods / survey / benchmark / theoretical). Spawn analyzers in parallel. Then enrich each summary with a Mermaid diagram, a concrete worked example, a plain-language explanation, and an honest assessment that uses your cross-paper knowledge. If the brief requires it, spawn `Explore` subagents for GitHub repos. Extract all reported benchmark results into `benchmark_data.md`.
→ **See `references/phase_3_analysis.md` for download handling, per-paper-type prompt templates, Mermaid diagram patterns, and the benchmark-extraction schema.**

### Phase 4 — Verification
Don't take paper claims at face value. Spawn a `general-purpose` verification subagent pointed at all `artifact_summary_*.md` files + `benchmark_data.md`. It cross-checks numbers across papers, assesses claim quality (benchmark validity, baseline strength, ablation honesty, efficiency/novelty/generalization, self-evaluation), detects contradictions, and flags missing baselines. Produces `verification_notes.md` with per-paper credibility ratings.
→ **See `references/phase_4_verification.md` for the verification subagent prompt, check rubric, and output schema.**

### Phase 5 — Synthesis
Structure the synthesis **around the review questions** from Phase 0, not around individual papers. For each question: direct answer, supporting evidence, confidence level (strong/moderate/weak), contradictions, gaps. Include method explanations (plain-language + Mermaid + worked example + honest pros/cons) and evidence tables built from verified benchmark data. Save `synthesis.md`, update the task's `artifacts` field, and suggest concrete next actions.
→ **See `references/phase_5_synthesis.md` for the synthesis structure, evidence-table template, artifact-list schema, and next-steps prompt.**

## Supporting references

| File | When to read |
|------|--------------|
| `references/phase_0_goal.md` | Starting the review — before the first user conversation |
| `references/phase_1_search.md` | Before running the first search round |
| `references/phase_2_screening.md` | When ready to screen the accumulated candidates |
| `references/phase_3_analysis.md` | Before crafting per-paper analyzer prompts |
| `references/phase_4_verification.md` | After all paper analyses land |
| `references/phase_5_synthesis.md` | When drafting the final output |
| `references/error_handling.md` | When a phase is stuck (few results, failed downloads, thin subagent output) |
| `references/artifact_structure.md` | When organizing files in the task folder |
| `references/checklist.md` | Before marking the review done |

## Working principle

**File-based communication.** Subagents read inputs from files in the task folder rather than receiving data pasted into prompts. The `review_brief.md` is the central intent document — point every subagent to it for context. This keeps the main agent's context window clean and creates a full paper trail of the review.
