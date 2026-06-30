# Documents & Files

## Viewing Files

Click any file link — in a task card, in chat, or in search results — to open it in a viewer tab. The system handles most file types automatically:

- **Markdown** (.md) — renders with formatting, headers, code blocks, tables
- **Code** (.py, .js, .ts, .go, etc.) — syntax highlighting, line numbers
- **JSON / YAML / CSV** — formatted display
- **PDF** — inline viewer, scroll through pages
- **Images** (.png, .jpg, .svg, etc.) — display inline
- **LaTeX** (.tex) — live preview and compilation (see below)
- **Diagrams** (.drawio) — interactive editor (see below)
- **Office documents** (.docx, .xlsx, .pptx) — web-based editor (see below)

---

## LaTeX Workspace

If you work with LaTeX documents, the system has a built-in LaTeX editor:

1. Open any `.tex` file
2. You'll see a **split view**: editor on the left, PDF preview on the right
3. Edit the source on the left — the preview updates as you type
4. **Bibliography**: if your project has a `.bib` file, citations auto-complete as you type `\cite{`
5. **Compile**: the system compiles to PDF automatically. Look for any errors in the error panel below.

Agents can write, edit, and compile LaTeX for you — just ask.

---

## Diagrams (draw.io)

`.drawio` files open in a full interactive diagram editor:

- Draw boxes, arrows, shapes with the toolbar
- Drag to move, resize handles to adjust
- Right-click for more options (copy style, add link, etc.)
- Changes save automatically

You can ask an agent to create a diagram: "Create a flowchart showing the data pipeline" — the agent will generate a `.drawio` file and you can open and edit it.

---

## Office Documents

`.docx`, `.xlsx`, and `.pptx` files open in a web-based editor (similar to Google Docs):

- Edit text, tables, and formatting directly
- Changes save in place — no need to download and re-upload
- For `.xlsx`: full spreadsheet with formulas
- For `.pptx`: slide editor with layout options

---

## Managing Files

**Upload a file:**
- Drag and drop onto the task card or file area
- Or click the **paperclip icon** in the chat to attach during a conversation

**Rename a file:**
- Right-click the file in the file browser → Rename

**Move a file:**
- Right-click → Move to → navigate to destination

**Delete a file:**
- Right-click → Delete (this is permanent — be sure)

**Download a file:**
- Click the download icon when the file is open in the viewer

---

## Agent Artifacts

When an agent completes a task, it produces output files — analyses, reports, proposals, code. These are called artifacts.

To find them:
1. Open the task card
2. Look for the **"Files"** tab or a list of artifacts below the task description
3. Click any file to view it

Artifacts are saved permanently with the task. You can reference them in future sessions: "Look at the analysis from last week's research task."

---

## Searching Files

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open global search. You can search:

- **By name** — type the filename or part of it
- **By content** — type words you remember from inside the file
- **Semantically** — describe what you're looking for in plain language

The search covers all your files, tasks, and agent outputs across all projects.
