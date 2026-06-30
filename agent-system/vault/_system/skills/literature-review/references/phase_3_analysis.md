# Phase 3 — Deep Analysis (detailed)

Download included papers and analyze them with subagents.

## Step 3.1 — Batch Download

Collect all PDF URLs for included papers and download them in a single batch call:

```
mcp__arxiv-search__download_paper(
  urls=["https://arxiv.org/pdf/2502.04644", "https://arxiv.org/pdf/2508.04604", ...],
  output_dir="<task_folder>/papers"
)
```

This converts each PDF to Markdown. The tool returns file paths for each successful download. Note any failures — for failed downloads, try alternate URLs (switch between `arxiv.org/pdf/` and `arxiv.org/abs/` formats, or use Semantic Scholar PDF links from search results).

After download, verify files exist by listing `<task_folder>/papers/`. Note the exact filenames — you'll need them for subagent invocation.

## Step 3.2 — Craft Elaborate Subagent Prompts

The paper-analyzer subagent's output quality is **directly proportional to the quality of the prompt you give it**. The `user_query` parameter drives Section 5 of its output — this is where all the useful, goal-specific extraction happens. A vague query produces a vague analysis.

**Rules for crafting the `user_query`:**

1. **Be specific to THIS paper**: What do you expect this paper to contribute to the review? A survey paper gets a different query than a methods paper or a benchmark paper.
2. **Reference the review brief**: Point the subagent to `review_brief.md` so it understands the broader context and questions.
3. **Ask for what the synthesis needs**: If your synthesis will have a comparison table, ask for the exact dimensions. If it needs architecture diagrams, ask for enough detail to draw one.
4. **Request diagram-ready descriptions**: The paper-analyzer produces text, not diagrams. Ask it to describe systems, processes, and data flows in a structured way you can later convert to Mermaid.
5. **Request worked examples**: Ask the subagent to trace through a concrete example if the paper contains one (or enough detail to construct one).
6. **Don't copy the template blindly**: Adapt the extraction categories to the paper type and the review's needs. Drop categories that don't apply, add ones that do.

**Prompt template — adapt per paper:**

```
paper_md_path: <absolute path to paper markdown>

user_query: |
  This paper is being analyzed as part of a literature review.
  Read the review brief at <task_folder>/review_brief.md for full context
  on the goal and specific questions this review needs to answer.

  Extract the following from this paper:

  1. METHOD / SYSTEM / APPROACH:
     - Describe what this paper proposes with all key components.
       Name each component, its input, its output, and what it does.
       Describe the flow step by step — what happens first, what triggers what,
       where are the decision points.
       This description must be detailed enough to draw a Mermaid diagram from it.
     - If the method has multiple stages or phases, describe each one separately.
     - What is genuinely novel vs. standard techniques applied in a new context?

  2. CONCRETE EXAMPLE / WALKTHROUGH:
     - Find or construct a concrete example showing how this method processes
       a specific input from start to finish. Use actual data from the paper
       if available (example inputs, case studies, running examples).
     - Trace through each step: what the input is, what each component does to it,
       what intermediate results look like, what the final output is.

  3. RESULTS:
     - For EVERY benchmark/evaluation reported: name, metric, this method's score,
       and all baseline/comparison scores mentioned.
     - Note the evaluation setup: dataset, split, number of examples, any filtering.
     - Note compute/cost: hardware, training time, inference cost if reported.

  4. PLAIN-LANGUAGE EXPLANATION:
     - Explain what this method does as if to a smart colleague who hasn't read
       the paper. No jargon soup. No marketing language. What problem does it solve?
       What's the core idea in simple terms? What's the "trick" that makes it work?

  5. HONEST ASSESSMENT:
     - What is this method actually good at, based on the evidence in the paper?
     - Where does it fall short or fail? What do the failure cases look like?
     - What assumptions does it make that might not hold in practice?
     - What's missing from the evaluation? What would you want to see tested?

  6. CONNECTIONS:
     - What does this paper cite as its closest prior work, and how does it differ?
     - [If you know of specific other papers in the review, name them here and ask
       the subagent to compare]
```

**How to adapt by paper type:**

For a **methods paper**, the template above works as-is. Emphasize architecture description and walkthrough.

For a **survey paper**, replace sections with:
```
  1. TAXONOMY: What categories/paradigms does this survey identify?
     For each: name, description, representative work, strengths, weaknesses.
     Describe each category in enough detail to draw a diagram.

  2. TECHNIQUES CATALOG: What specific techniques are covered?
     For each: name, category, how it works, who uses it, reported effectiveness.

  3. BENCHMARKS LANDSCAPE: What evaluation benchmarks does it catalog?
     For each: name, what it measures, size, key metrics.

  4. BEST PRACTICES: What design recommendations does the survey make?
     What are the identified open problems and future directions?

  5. REFERENCE MINING: List the 10 most important papers this survey references
     that seem relevant to our review. For each: title, why it matters.
```

For a **benchmark/dataset paper**, replace with:
```
  1. WHAT IT MEASURES: What capability or behavior does this benchmark test?
     What task setup? What are the evaluation criteria?

  2. DATASET DETAILS: Size, splits, domains, data sources, construction method.
     Any known biases or limitations of the dataset itself?

  3. BASELINE RESULTS: All methods evaluated, with exact scores and metrics.
     Which methods were strongest? Where did methods fail?

  4. EVALUATION PROTOCOL: Exact metrics, how they're computed, any human eval
     components, statistical significance tests if reported.

  5. USEFULNESS ASSESSMENT: Is this benchmark appropriate for our review's goals?
     Is it saturated? Too narrow? Well-adopted by the community?
```

For a **theoretical/analysis paper**, replace with:
```
  1. CORE ARGUMENT: What is the central claim or insight?
     What evidence or proof supports it?

  2. IMPLICATIONS: What does this mean for practitioners?
     What should change about how we build/evaluate systems?

  3. SCOPE AND LIMITATIONS: Under what conditions does the analysis hold?
     What assumptions are made?

  4. EMPIRICAL VALIDATION: Is the theory backed by experiments?
     If so, what setup? If not, how strong is the theoretical argument alone?
```

## Step 3.3 — Spawn Paper-Analyzer Subagents (parallel)

For each downloaded paper, spawn a `paper-analyzer` subagent via the Task tool. **Launch these in parallel** — send multiple Task tool calls in a single message:

```
Task tool call 1:
  subagent_type: paper-analyzer
  description: "Analyze [short paper name]"
  prompt: |
    paper_md_path: /absolute/path/to/task_folder/papers/XXXX.XXXXX_Paper_Title.md
    user_query: "<elaborate query as crafted in Step 3.2>"

Task tool call 2:
  subagent_type: paper-analyzer
  description: "Analyze [short paper name]"
  prompt: |
    paper_md_path: /absolute/path/to/task_folder/papers/YYYY.YYYYY_Another_Paper.md
    user_query: "<elaborate query as crafted in Step 3.2>"

... (one per paper, all in the same message for parallel execution)
```

Each subagent will:
- Read the review brief (if pointed to it in the query) for context
- Read the paper markdown
- Produce a structured 5-section summary grounded only in the paper text
- Save `artifact_summary_{filename}.md` in the same `papers/` folder
- Return a summary of findings

**Use `run_in_background: true`** for parallel execution when analyzing many papers. Check outputs afterward by reading each `artifact_summary_*.md`.

**If a subagent's output is thin or missing detail you asked for**: The paper markdown may have poor PDF→MD conversion (lost tables, garbled figures). Read the paper markdown yourself, find the missing sections, and supplement the analysis directly.

## Step 3.4 — Method Explanation Enrichment

After all subagent analyses complete, read each `artifact_summary_*.md`. The paper-analyzer produces text descriptions, but the synthesis needs **visual and interactive elements**. For every method or approach, create:

**1. Mermaid diagram** — convert architecture/process descriptions from subagent output into diagrams.

Pick the style that best fits what you're showing:

- **`graph TD`** (top-down flowchart) — for pipelines, architectures, and multi-stage systems:
  ````markdown
  ```mermaid
  graph TD
      A["Input"] --> B["Component A<br/><i>What it does</i>"]
      B --> C{"Decision Point"}
      C -->|Path 1| D["Component B"]
      C -->|Path 2| E["Component C"]
      D --> F["Output Stage"]
      E --> F

      style B fill:#e1f5fe
      style D fill:#fff3e0
  ```
  ````

- **`sequenceDiagram`** — for interactions between multiple actors/agents/systems:
  ````markdown
  ```mermaid
  sequenceDiagram
      participant U as User
      participant A as Agent A
      participant B as Agent B

      U->>A: Request
      A->>A: Process internally
      A->>B: Delegate subtask
      B-->>A: Subtask result
      A->>U: Final response
  ```
  ````

- **`graph LR`** (left-right) — for data transformation chains and linear flows:
  ````markdown
  ```mermaid
  graph LR
      A["Raw Input"] --> B["Transform 1"]
      B --> C["Transform 2"]
      C --> D["Filter"]
      D --> E["Final Output"]
  ```
  ````

**Diagram guidelines:**
- Label every node with its name AND a brief description of what it does (use `<br/>` for line breaks)
- Show decision points with `{}` diamond nodes
- Use color coding (`style X fill:#color`) to group related components
- Keep it readable — no more than 12-15 nodes per diagram. Split complex systems into multiple diagrams.
- The subagent's architecture description should give you enough to draw this. If not, read the paper markdown directly.

**2. Concrete worked example** — trace a specific input through the method. Use data from the paper if available, or construct a realistic example:

```markdown
### Example: How [Method] processes [specific input]

**Step 1 — [First stage name]:**
Input: [what goes in]
Output: [what comes out, with concrete values]

**Step 2 — [Second stage name]:**
Input: [output from Step 1]
Processing: [what happens, concretely]
Output: [intermediate result with specific data]

**Step 3 — [Final stage name]:**
Input: [previous outputs]
Output: [final result the user sees]
```

Make the method tangible. Abstract descriptions like "the encoder processes the input" are useless. Instead: "the encoder takes the 512-token passage and produces a 768-dim embedding vector."

**3. Plain-language explanation** — if the subagent's explanation uses too much jargon, rewrite it. Target audience: a smart colleague who understands the general field but hasn't read this specific paper.

**4. Honest assessment** — combine the subagent's assessment with your own cross-paper knowledge. The subagent only sees one paper, so it can't know that another paper solved the same problem better, or that a claimed limitation has been addressed elsewhere. Add this context.

## Step 3.5 — Conditional Code Analysis

If the review brief specifies code analysis, check each paper for a GitHub link (usually in the abstract, introduction, or footnotes).

For papers with repos, spawn an `Explore` subagent:

```
Task tool:
  subagent_type: Explore
  prompt: |
    Analyze the repository at <github_url>. Focus on:
    1. Architecture overview — main components and how they connect
    2. Does the implementation match what the paper describes? Flag any discrepancies.
    3. What shortcuts or simplifications were made vs. the paper?
    4. Key dependencies and their versions
    5. Check GitHub issues for common problems (does it actually run?)
    6. Last commit date, stars, fork count — is this maintained?
```

Save each code analysis as `code_analyses/code_analysis_{short_name}.md`.

**Size guard**: If a repo is very large (>100 files in core), instruct the Explore agent to focus on entry points, configuration, and the core algorithm — not the entire codebase.

## Step 3.6 — Benchmark Extraction

As you read paper-analyzer outputs, extract all reported benchmark/evaluation results into a structured file. Save to `<task_folder>/benchmark_data.md`:

```markdown
# Benchmark Data Extracted

## Results Table
| Paper | Method | Benchmark | Metric | Value | Conditions | Compute |
|-------|--------|-----------|--------|-------|------------|---------|
| [Paper A] | [their method] | [benchmark name] | [metric] | [score] | [setup notes] | [hardware/cost] |
| [Paper A] | [baseline 1] | [benchmark name] | [metric] | [score] | [as reported by Paper A] | - |
| [Paper B] | [their method] | [same benchmark] | [metric] | [score] | [setup notes] | [hardware/cost] |
| ... | | | | | | |

## Cross-Reference Flags
[Note any cases where multiple papers report different numbers for the same
method on the same benchmark. These indicate evaluation setup differences.]
```

This file serves as input for the verification subagent and for building comparison tables in the synthesis.
