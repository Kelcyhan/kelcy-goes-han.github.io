# Phase 1 — Iterative Search (detailed)

Search aggressively and persistently. The goal is high recall — don't stop at the first batch.

**Key principle: save every search round to a file.** This creates a paper trail and enables subagents to read results without the main agent pasting data into prompts. The `output_file` parameter on `mcp__arxiv-search__search_papers` handles this automatically — each search writes a structured markdown table to the specified path.

## Step 1.1 — Search Round Execution

For each round, run queries with `mcp__arxiv-search__search_papers` using `output_file` to auto-save results:

```
mcp__arxiv-search__search_papers(
  query="<query string>",
  max_results=20,
  min_date="<from review brief, e.g. 2024-01-01>",
  output_file="<task_folder>/search_results/round_N_<strategy>.md"
)
```

The tool saves a markdown file with a header (query, date filter, result count) and a table (`| # | Title | Year | Venue | Cites | Abstract | PDF URL |`). If you run multiple queries per round, use a different `output_file` path for each query, or consolidate results into a single round file afterward.

## Step 1.2 — Search Strategy by Round

**Round 1 — Direct queries (parallel):**
Run 3-5 seed queries from the review brief in parallel. Each should phrase the topic differently:
- Technical term version
- Problem-focused version
- Method-focused version

Use `output_file="<task_folder>/search_results/round_1_direct_<n>.md"` for each query.

**Round 2 — Survey discovery:**
Search for "survey <topic>" and "review <topic> methods". Surveys map the field — their reference lists are gold for snowballing. If a good survey is found, download it immediately and skim its references.

Use `output_file="<task_folder>/search_results/round_2_surveys.md"`.

**Round 3 — Terminology expansion:**
Read through round 1 and round 2 result files. Extract new terms:
- Technical terms you didn't search for
- Specific method names
- Benchmark names
- Prolific author names

Run new queries with these expanded terms. Use `output_file="<task_folder>/search_results/round_3_expanded.md"`.

**Round 4+ — Snowball and fill gaps:**
Assess coverage against the review questions. For gaps, construct targeted queries. For promising leads, follow citation chains.

Use `output_file="<task_folder>/search_results/round_N_<strategy>.md"` for each query.

**Stopping rule**: stop when **3 consecutive rounds produce no new relevant candidates**, or when coverage across all review questions is adequate.

## Step 1.3 — Compile Search Log

After all rounds, compile `search_log.md` summarizing the full search:

```markdown
# Search Log

## Rounds
| Round | Strategy | Queries | Results | New candidates | File |
|-------|----------|---------|---------|----------------|------|
| 1 | Direct queries | 4 | 52 | 12 | search_results/round_1_direct.md |
| 2 | Surveys | 2 | 15 | 3 (1 survey) | search_results/round_2_surveys.md |
| 3 | Terminology expansion | 5 | 28 | 6 | search_results/round_3_expanded.md |
| 4 | Gap-filling | 3 | 9 | 0 | search_results/round_4_gaps.md |
| — | STOPPED: diminishing returns | | | | |

## Coverage Assessment
- Q1: [N papers — well covered / gaps in X]
- Q2: [N papers — adequate / thin]
- ...

Total: N unique candidates from M queries across K rounds
```
