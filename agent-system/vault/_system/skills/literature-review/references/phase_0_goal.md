# Phase 0 — Understand the Goal (detailed)

Before any search, understand **why** this review is being done and **what the user will do with the results**.

## Step 0.1 — Investigate Context (autonomous)

Read the task system to build your own understanding before talking to the user:

1. **Read the active task** — the task this review is for. Note its `desc`, `outcome` (if partially filled), and any `notes`.
2. **Read the parent task** — understand the bigger objective this review serves. Follow `parent` up to the project root if needed.
3. **Read dependency outcomes** — for each ID in `deps`, find the task file and read its `outcome`. These tell you what's already established.
4. **Read sibling tasks** — other tasks under the same parent. These show what else is happening in parallel and what the review feeds into.
5. **Check for existing literature artifacts** — search the task folder and parent folders for `papers/`, `synthesis.md`, `artifact_summary_*.md`, or `artifact_related_research.md`. If prior reviews exist, read them to understand what's already known.

From this investigation, form a hypothesis:

- What is the user building / investigating / writing?
- What decisions depend on this review?
- What do they probably already know (from prior task outcomes)?
- What kind of evidence would be most useful?

## Step 0.2 — Talk to the User

Don't present a menu. State what you've learned and have a conversation:

1. **State your understanding**: "Based on the task context, you're working on [X] as part of [Y]. You need to understand [Z] so you can [W]. Is that right?"
2. **Ask targeted clarifying questions**:
   - What specific questions should this review answer?
   - Is there a particular aspect you care most about?
   - Are there papers or approaches you already know about?
   - What will you do with the results? (build, write, decide, compare)
3. **Think deeply** about what the user needs to succeed — including things they haven't asked about. Consider:
   - What questions they should be asking but aren't
   - What information would change their approach
   - What format would make results most actionable for their specific goal

## Step 0.3 — Propose a Review Plan

Based on context + conversation, propose:

1. **Scope**: topics and questions the review covers
2. **Output format**: what to produce. Think about what serves the user's actual goal — don't default to a generic summary. Consider formats like:
   - Comparative matrix (approaches × dimensions)
   - Honest leaderboard (cross-verified benchmark results with caveats)
   - Architecture diagrams with plain-language walkthroughs
   - Decision guide ("if your situation is X, use Y because Z")
   - Pattern catalog with concrete examples
   - Gap analysis (tried / untried / failed)
   - Execution traces / worked examples
   - Cost-performance Pareto analysis
   - Or something else entirely — invent a format if the goal demands it
3. **Depth**: approximate number of papers, whether to analyze code repos
4. **Initial search queries**: concrete queries you'll start with

**Wait for user confirmation before proceeding.**

## Step 0.4 — Save the Review Brief

Write `review_brief.md` in the task's artifact folder:

```markdown
# Literature Review Brief

## Goal
[What the user is trying to achieve and why this review matters]

## Questions
1. [Specific question 1]
2. [Specific question 2]
...

## Output Format
[Agreed format, structure, and what each section should contain]

## Scope
- Topics: [...]
- Depth: [quick ~5-8 papers / standard ~10-20 / deep 20+]
- Code analysis: [yes/no, conditions]
- Date range: [e.g., 2024-present, or all time]

## Initial Search Strategy
- Seed queries: ["query 1", "query 2", ...]
- Key terms: [domain vocabulary]
- Known papers to include: [any papers user mentioned]
```
