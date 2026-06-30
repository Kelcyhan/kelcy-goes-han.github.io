# Working with AI Agents

## What Agents Do

Agents are AI assistants that do work for you. You describe a task in plain language; the agent figures out the approach, plans the steps, and executes them. They can research topics, write documents, analyze data, write and debug code, organize your project, and much more.

You stay in control throughout. Agents propose before they act, and they check in when they hit decisions that need your judgment.

---

## Spawning an Agent

To get an agent working on a task:

1. Open the task card in the PM workspace
2. Click **"Spawn Agent"** or **"Set up with AI"**
3. An agent session appears in the left sidebar — you'll see it connect and start reading

Or, from the session panel:
- Click **"New Session"** → starts a concierge session
- Tell the concierge what you want to work on, and it will route to the right task

---

## The Plan → Approve → Execute Cycle

This is the core workflow. Every significant agent task follows this pattern:

### 1. Planning phase

The agent reads your task description, gathers context from your project, and writes a plan. You'll see something like:

> "Here's my plan for this task:
> 1. Search for papers on X
> 2. Read and summarize the top 10 results
> 3. Write a 500-word synthesis
> 4. Check my work against your criteria
> Does this look right?"

A notification appears in the right panel: **"Review plan for [task name]"**.

### 2. Your approval

Click the notification → read the plan → choose:
- **Approve** — agent proceeds immediately
- **Type a response** — redirect the agent, add constraints, ask questions
- **Reject** — agent goes back to re-plan

Don't just rubber-stamp every plan. Reading it takes 30 seconds and catches most misunderstandings early.

### 3. Execution

The agent works through its plan step by step. You can watch the chat panel for live updates. The session status dot turns green.

You can message the agent while it's working:
- Ask a question → it will answer and continue
- Say "stop and check in" → it will pause and wait for instructions
- Give new information → it will incorporate it

### 4. Automatic verification

When the agent finishes, it checks its own work against your task's success criteria. If it passes, the task is marked done. If it finds gaps, it fixes them and checks again.

You'll get a notification when the task is complete. Review the output, and if you're happy with it, that's it — done.

---

## Watching Agents Work

**Session panel (left sidebar):**
- **Green dot** = working
- **Yellow dot** = waiting for you (check notifications!)
- **Grey dot** = idle or finished

**Chat panel:**
The main chat shows what the agent is saying and doing. It describes its reasoning, shares progress, and asks questions here.

**Terminal tab:**
The terminal shows raw live output. Useful for seeing exactly what the agent is running, especially for code or file operations.

---

## Talking to Agents

You can message an agent at any time in the chat:

**During planning:** "Actually, focus on papers from 2022 onward" — the agent will update its plan.

**During execution:** "Quick question: should I include the related work section?" — the agent will answer and continue.

**After completion:** "Can you add a conclusion section?" — the agent will extend the work.

**Attachments:** Click the paperclip icon in the chat input to attach a file. "Here's the paper I mentioned — summarize it."

**Voice input:** Click the microphone icon to speak instead of type. Your words are transcribed and sent to the agent.

---

## The Notification Panel (Right Sidebar)

This is where agents ask for your attention. Types of notifications:

| Type | What it means | What to do |
|------|--------------|------------|
| **Review plan** | Agent has a plan ready for your approval | Read and approve/reject |
| **Read document** | Agent produced an artifact for you to review | Open and read it |
| **Decision needed** | Agent hit a fork and needs your input | Choose a direction |
| **Action required** | Agent needs you to do something external | Do the thing, then respond |

**Important:** A yellow dot on a session means the agent is waiting on YOU. It won't continue until you respond. Check the notification panel if you see yellow dots.

---

## Resuming Past Sessions

Agents' conversations are saved. You can come back to any session:

1. Click a past session in the session panel
2. The full conversation history loads in the chat panel
3. The agent remembers everything from before

If you want to continue where you left off:
- Just send a message — "let's keep going" or a new instruction
- The agent will pick up the thread

---

## Tips for Better Results

**Be specific.** The more detail you give, the better the plan.
- ❌ "Do some research on agents"
- ✅ "Research multi-agent AI architectures. Focus on papers from 2022–2025. Summarize the top 5 approaches in a table comparing them on complexity, scalability, and adoption."

**Describe what "done" looks like.** What does a successful result include?
- ❌ "Write a proposal"
- ✅ "Write a 2-page proposal covering: the problem (1 paragraph), our approach (3 bullet points), expected timeline (table), and required resources (brief list)."

**Set scope limits.** Tell the agent what NOT to do if relevant.
- "Don't implement anything — just investigate and propose"
- "Keep the total output under 1000 words"
- "Focus on the frontend only, ignore the backend for now"

**Redirect mid-task.** If the agent is going the wrong direction, just say so. It's not a problem — it happens.

**Start fresh for new topics.** If you've been working on something for a long time and want to switch to something unrelated, start a new session. Agents work best with focused context.
