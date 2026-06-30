# Phase 5 — Synthesis (detailed)

Produce the final output in the format agreed upon in Phase 0. This is where all the subagent outputs, verification notes, and your own analysis come together.

## Step 5.1 — Read All Inputs

Before writing the synthesis, read:
1. All `artifact_summary_*.md` files (paper-analyzer outputs)
2. `verification_notes.md` (your cross-checks)
3. Any `code_analysis_*.md` files
4. The `review_brief.md` (to stay aligned with user's goal and questions)

## Step 5.2 — Draft the Synthesis

Structure the synthesis around the **review questions from Phase 0**, not around individual papers. For each question:

1. **Direct answer** — what does the evidence say?
2. **Supporting evidence** — which papers, what numbers, from which sections
3. **Confidence level**:
   - **Strong**: Multiple independent papers agree, solid methodology
   - **Moderate**: 2-3 papers agree, or one strong paper with thorough evaluation
   - **Weak**: Single paper, limited evaluation, or contradicted by other work
4. **Contradictions** — where papers disagree and why
5. **Gaps** — what remains unanswered

## Step 5.3 — Method Explanations

For every method/approach in the synthesis, include:
- Plain-language explanation (no jargon soup)
- Mermaid diagram of architecture/flow
- Concrete worked example
- Honest pros/cons with evidence

These can be inline or linked to separate sections — whatever makes the synthesis more readable.

## Step 5.4 — Evidence Tables

Build comparison tables from the benchmark data extracted in Phase 3.6, filtered through verification in Phase 4:

```markdown
## Honest Comparison: [Benchmark Name]

| Method | Paper | Score | Compute | Code | Caveats |
|--------|-------|-------|---------|------|---------|
| Method A | [Paper 1] | 92.1% | 1x GPU | Yes (MIT) | Trained on extra data |
| Method B | [Paper 2] | 89.4% | 4x GPU | No | Non-standard eval split |
| Strong baseline | [Multiple] | 82-86% | varies | N/A | Range reflects different eval setups |

**Notes:**
- Paper 1 and Paper 3 disagree on baseline score (82% vs 86%) — likely different prompt templates
- Method B did not compare against Method A despite publishing later
- Method A's score uses additional training data not available to other methods
```

## Step 5.5 — Save All Artifacts

Save the synthesis as `synthesis.md` (L1 artifact). Then update the task's YAML `artifacts` field:

```yaml
artifacts:
  - path: review_brief.md
    desc: "Review intent — goal, questions, scope, search strategy"
  - path: synthesis.md
    desc: "Main synthesis answering review questions with evidence tables and method explanations"
  - path: search_results/
    desc: "Raw search results per round"
  - path: search_log.md
    desc: "Summary of all search rounds with coverage assessment"
  - path: screened_papers.md
    desc: "Screening decisions with rationale"
  - path: papers/
    desc: "N downloaded papers with paper-analyzer summaries"
  - path: benchmark_data.md
    desc: "Extracted benchmark results across all papers"
  - path: verification_notes.md
    desc: "Cross-paper verification and claim assessment"
  - path: code_analyses/
    desc: "Code repository analyses (if applicable)"
```

## Step 5.6 — Proactive Next Steps

After delivering the synthesis, suggest concrete next actions:
- Specific gaps that need further investigation
- Papers that deserve deeper reading (beyond the summary)
- Practical actions based on findings (e.g., "try method X first because...")
- Whether the review scope should be expanded in a particular direction
- New tasks that should be created in the task system based on findings
