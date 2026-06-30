# Phase 2 — Screening (detailed)

Screen for **utility to the user's goal**, not just topic relevance.

## Step 2.1 — Spawn Screening Subagent

The screening subagent reads directly from the files you've created — the review brief and all search round results. Don't paste data into the prompt; give it file paths.

```
Task tool:
  subagent_type: general-purpose
  prompt: |
    You are screening academic papers for a literature review.

    ## Your inputs (read these files first):
    1. Review brief: <task_folder>/review_brief.md
       — Contains the goal, specific questions, and scope
    2. Search results (read ALL of these):
       - <task_folder>/search_results/round_1_direct.md
       - <task_folder>/search_results/round_2_surveys.md
       - <task_folder>/search_results/round_3_expanded.md
       - ... (list all round files)

    ## Your task
    Assess each candidate paper's UTILITY — not just topic relevance, but whether
    it will actually help the user achieve the goal described in the review brief.

    ## Scoring Rubric

    **INCLUDE** — High utility. Directly addresses a review question. Contains
    method details, benchmark results, or concrete findings the user needs.
    Worth downloading and analyzing in full.

    **BORDERLINE** — Uncertain utility. On-topic but unclear if it adds value
    beyond other papers. Or: important topic but weak methodology/venue.

    **EXCLUDE** — Low utility. Off-topic, superseded by newer work, no evaluation,
    or duplicates another candidate's contribution.

    ## Instructions
    - Write a one-sentence rationale for EVERY paper
    - Don't include papers just because they're cited — they must be USEFUL
    - Flag if multiple papers cover the same ground (keep the best, borderline the rest)
    - Flag if a review question has NO papers addressing it
    - Be aggressive about excluding: 10 high-utility papers > 25 mediocre ones
    - Deduplicate across rounds (same paper may appear in multiple search rounds)

    ## Output
    Write your results to: <task_folder>/screened_papers.md

    Use this structure:

    # Screened Papers

    ## Included (N papers)
    | # | Title | Year | Venue | Cites | PDF URL | Rationale | Questions addressed |
    |---|-------|------|-------|-------|---------|-----------|-------------------|

    ## Borderline (N papers)
    | # | Title | Year | Venue | Cites | PDF URL | Concern |
    |---|-------|------|-------|-------|---------|---------|

    ## Excluded (N papers)
    | # | Title | Year | Reason |
    |---|-------|------|--------|

    ## Coverage Assessment
    For each review question, note which included papers address it and flag gaps.
```

## Step 2.2 — Review Screening and Present to User

Read `screened_papers.md` produced by the subagent. Present to the user:

```
Screening complete: X candidates → Y included, Z borderline, W excluded.

**Included (Y papers):**
1. "Paper Title" (2025, Venue, N cites) — [rationale]
2. ...

**Borderline (Z papers):**
1. "Paper Title" (2024) — [concern]
2. ...

Coverage: Q1 well-covered, Q2 adequate, Q3 thin (only 1 paper).

Should I proceed with the included papers? Want to add/remove any?
```

Wait for user confirmation. Update `screened_papers.md` with user decisions on borderline papers.
