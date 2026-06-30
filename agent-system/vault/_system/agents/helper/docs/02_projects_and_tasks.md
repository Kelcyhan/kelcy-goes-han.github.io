# Managing Projects & Tasks

## How Work is Organized

The system uses three levels:

- **Projects** — Your big goals. "Build a website", "Write my thesis", "Research AI agents for my lab". A project has a name, a vision, and contains all the work underneath it.

- **Areas** — Groups of related tasks inside a project. Like folders. "Design", "Backend", "Testing" might be areas inside a "Build a Website" project. Not every project needs areas — small projects can just have tasks directly.

- **Tasks** — Specific pieces of work. "Design the login page", "Write the literature review", "Set up CI/CD". This is what agents work on.

Think of it like: **Project → Areas (optional) → Tasks**.

---

## Creating Things

### New Project

1. Click **"New Project"** in the PM workspace toolbar
2. Enter a name and a short description of what success looks like
3. Click **Create**
4. Optional: click **"Set up with AI"** — an agent will suggest an initial structure (areas, first tasks)

### New Area (inside a project)

1. Navigate into a project
2. Click **"New Area"** or **"+ Add Area"**
3. Give it a name — areas are just organizational groupings

### New Task

1. Navigate to where you want the task (project root or inside an area)
2. Click **"New Task"** or **"+ Add Task"**
3. Enter a title — be specific: "Write introduction section (500 words)" not just "Write intro"
4. Add a description if you want — the more detail, the better the agent's plan
5. Click **Create**

---

## Navigating the PM Workspace

The PM workspace shows cards in a grid. Click any card to go inside it. Press **Escape** or **Backspace** to go up a level.

The **breadcrumb** at the top shows where you are:
```
Projects  /  My Thesis  /  Literature Review
```

Click any part of the breadcrumb to jump back up.

**Viewing options:**
- Cards show the title, status, and a brief summary
- Click a card to open it and see full details, linked files, and agent sessions

---

## Task Statuses

Tasks go through these stages (you'll see these as labels on cards):

| Status | What it means |
|--------|--------------|
| **To do** | Created but no agent has started yet |
| **In progress** | An agent is actively working on it |
| **Waiting for input** | An agent needs your response to continue |
| **Done** | Complete — output has been reviewed and verified |
| **Paused** | Intentionally on hold |
| **Blocked** | Can't proceed — waiting on something external |

You can change a task's status manually from the task card menu.

---

## Goals & Milestones

Goals let you track progress toward important outcomes across all your projects.

**Creating a goal:**
1. Click **"Goals"** in the top navigation or the goals widget on the home screen
2. Click **"New Goal"**
3. Give it a name ("Submit thesis draft"), a target date, and a description
4. Optionally break it into **milestones** — intermediate checkpoints

**Linking tasks to goals:**
- Open a task card → click **"Link to Goal"** → select the goal
- Now when tasks complete, the goal's progress bar advances

**Goal roadmap:**
- The Goals view shows all goals as a timeline with progress bars
- Red = behind schedule, yellow = tight, green = on track

---

## Editing Tasks

**Rename a task:** Click the title on the card and type a new name.

**Edit description:** Click inside the description area on the task card detail view.

**Change status:** Click the status badge → select new status from dropdown.

**Move a task:**
1. Click the **⋯ menu** on the task card
2. Choose **"Move to..."**
3. Search for the destination project or area
4. Confirm

**Delete a task:** From the ⋯ menu → "Delete". Note that deleting a task also removes all agent work associated with it.

---

## Files & Artifacts

When an agent completes a task, its output (reports, analyses, documents) is attached to the task.

To view agent output:
1. Click the task card to open it
2. Look for the **"Files"** tab or the artifacts list
3. Click any file to open it in the viewer

You can also manually attach files to a task:
- Drag and drop a file onto the task card
- Or click the **paperclip icon** in the task detail view
