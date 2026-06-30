# End-of-Review Checklist

Before completing the review, verify all items:

**Phase 0:**
- [ ] Task context investigated (active task, parent, deps, siblings, existing artifacts)
- [ ] User conversation completed — goal and questions understood
- [ ] Review plan proposed and confirmed by user
- [ ] `review_brief.md` saved

**Phase 1:**
- [ ] Multiple search rounds executed (direct, survey, terminology expansion, snowball)
- [ ] Each round saved to `search_results/round_N_<strategy>.md`
- [ ] 3+ query phrasings per concept tried
- [ ] Coverage assessed against all review questions
- [ ] `search_log.md` saved with summary of all rounds

**Phase 2:**
- [ ] Screening subagent spawned with file paths to `review_brief.md` + all `search_results/*.md`
- [ ] `screened_papers.md` produced by subagent and reviewed
- [ ] Results presented to user, user confirmed included/excluded papers
- [ ] `screened_papers.md` updated with user decisions

**Phase 3:**
- [ ] All included papers downloaded as markdown (batch `download_paper` call)
- [ ] Elaborate per-paper prompts crafted (adapted to paper type: methods/survey/benchmark/theory)
- [ ] Prompts reference `review_brief.md` by path for context
- [ ] Paper-analyzer subagents spawned in parallel
- [ ] All `artifact_summary_*.md` files produced and reviewed for completeness
- [ ] Thin outputs supplemented by reading paper markdown directly
- [ ] Mermaid diagrams created for each method (appropriate style per method)
- [ ] Concrete worked examples created for each method
- [ ] Code analysis done for repos (if applicable per brief)
- [ ] `benchmark_data.md` saved with structured extraction across all papers

**Phase 4:**
- [ ] Verification subagent spawned with file paths (not pasted data)
- [ ] `verification_notes.md` produced and reviewed
- [ ] Discrepancies and weak claims noted for synthesis
- [ ] Paper credibility levels assessed (HIGH / MODERATE / LOW)

**Phase 5:**
- [ ] Synthesis structured around review questions (not per-paper)
- [ ] Confidence levels assigned to all findings
- [ ] Contradictions and gaps documented
- [ ] Evidence tables with verified numbers and caveats
- [ ] Proactive next steps suggested
- [ ] Task YAML `artifacts` field updated
