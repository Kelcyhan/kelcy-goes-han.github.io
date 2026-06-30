# Phase 4 — Verification (detailed)

Don't take any single paper's claims at face value. This is analytical work that benefits from focused attention — hand it off to a dedicated subagent.

## Step 4.1 — Spawn Verification Subagent

The verification subagent reads ALL paper analyses from files and cross-checks claims. Point it at the files — don't paste content into the prompt.

```
Task tool:
  subagent_type: general-purpose
  prompt: |
    You are a verification agent for a literature review. Your job is to cross-check
    claims across papers, find inconsistencies, flag weak methodology, and identify
    missing baselines. Be skeptical — papers oversell their contributions.

    ## Your inputs (read these files):
    1. Review brief: <task_folder>/review_brief.md
    2. Paper analyses (read ALL artifact_summary_*.md files in):
       <task_folder>/papers/
    3. Benchmark extraction: <task_folder>/benchmark_data.md
       (If this file doesn't exist, extract benchmark data from the summaries yourself)

    ## Verification Checks

    For EACH paper, check every major claim:

    ### 1. Cross-Paper Number Consistency
    When multiple papers report results on the SAME benchmark:
    - Do the baseline numbers match? (e.g., if Paper A says "Baseline X gets 72%"
      and Paper B says "Baseline X gets 68%", there's an evaluation setup
      difference that undermines direct comparison.)
    - Flag ALL such discrepancies with both values and the papers that report them.

    ### 2. Claim Quality Assessment
    For each major claim, assess:

    | Check | What to look for |
    |-------|-----------------|
    | Benchmark validity | Is it appropriate? Saturated (everyone at 99%)? Their own benchmark? |
    | Baseline strength | Did they compare against the obvious strong baseline, or cherry-pick weak ones? |
    | Ablation honesty | Do ablations isolate the contribution, or are multiple things changing? |
    | Efficiency claims | "More efficient" — wall-clock time or just FLOPs? On what hardware? |
    | Novelty claims | "We are the first to..." — does prior work exist in the other papers? |
    | Generalization | One dataset or multiple? In-distribution or out-of-distribution? |
    | Self-evaluation | Did they evaluate on their own benchmark? If so, flag reduced credibility. |

    ### 3. Contradiction Detection
    Do any papers directly contradict each other? For each contradiction:
    - What's the claim?
    - Which papers disagree?
    - What's the likely reason? (different settings, data, definitions, cherry-picking)

    ### 4. Missing Baselines and Comparisons
    For each paper:
    - What's the strongest method they DIDN'T compare against?
    - Were any other papers in this review published before theirs but not cited?

    ## Output Format

    Produce a markdown file `verification_notes.md` with this structure:

    # Verification Notes

    ## Cross-Paper Discrepancies
    | Benchmark | Method | Paper A (value) | Paper B (value) | Likely cause |
    |-----------|--------|-----------------|-----------------|-------------|

    ## Per-Paper Verification

    ### Paper: [Title] ([ID])
    - **Claim**: "[exact claim]" → VERIFIED / PARTIAL / UNVERIFIED / CONTRADICTED
      - Evidence: [what supports or undermines this]
    - **Claim**: "[next claim]" → ...
    - **Missing baselines**: [what they should have compared against]
    - **Methodology concerns**: [any issues]
    - **Overall credibility**: HIGH / MODERATE / LOW — [brief justification]

    ### Paper: [next paper]
    ...

    ## Contradictions Found
    1. [Description of contradiction with papers involved]
    2. ...

    ## Papers with Weakest Evidence
    [List papers whose claims are least well-supported, and why]

    ## Claims with Strongest Consensus
    [List findings supported by multiple independent papers]

    Write the output to: <task_folder>/verification_notes.md
```

## Step 4.2 — Review Verification Results

Read `verification_notes.md` produced by the subagent. Check for:
- Any claims you should investigate further (read the original paper markdown if needed)
- Discrepancies that affect the synthesis — these must be noted in the final output
- Papers whose credibility is LOW — consider whether they should be downweighted or excluded from the synthesis

If verification reveals serious issues with a paper's claims, note this for the synthesis phase — don't silently use questionable numbers in comparison tables.
