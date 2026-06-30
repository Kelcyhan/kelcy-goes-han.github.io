# Artifact Structure Reference

```
task_folder/
├── review_brief.md                    # L1 — Intent, goal, questions, scope (Phase 0)
├── synthesis.md                       # L1 — Final synthesis (Phase 5)
├── search_results/                    # L2 — Raw search results per round (Phase 1)
│   ├── round_1_direct.md
│   ├── round_2_surveys.md
│   ├── round_3_expanded.md
│   └── ...
├── search_log.md                      # L2 — Summary of all rounds (Phase 1)
├── screened_papers.md                 # L2 — Screening decisions (Phase 2)
├── benchmark_data.md                  # L2 — Extracted benchmark table (Phase 3)
├── verification_notes.md              # L2 — Cross-paper checks (Phase 4)
├── papers/                            # L3 — Downloaded papers + summaries
│   ├── XXXX.XXXXX_Paper_Title.md                    # Raw paper markdown
│   ├── artifact_summary_XXXX.XXXXX_Paper_Title.md   # Subagent analysis
│   └── ...
└── code_analyses/                     # L3 — Repo analyses (if applicable)
    ├── code_analysis_short_name.md
    └── ...
```

**File-based communication**: Subagents read from these files rather than receiving data pasted into prompts. The `review_brief.md` is the central intent document — every subagent should be pointed to it for context.
