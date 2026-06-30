# LaTeX Environment Guide

The vault has a LaTeX editing and compilation environment. The user has a dashboard with a two-pane LaTeX editor (CodeMirror 6 source editor | PDF preview) that updates in real-time when you edit files.

## What the User Sees

When the user opens a `.tex` file in the dashboard, they get:
- **Left pane:** LaTeX source editor with syntax highlighting, autocomplete, code folding
- **Right pane:** Compiled PDF preview (browser-native viewer)
- **Autosave:** Their edits save automatically after 2 seconds
- **Live refresh:** When you (the agent) edit the `.tex` file on disk, the editor updates within ~2 seconds via SSE

This means: **you can collaboratively edit LaTeX files with the user in real-time.** You edit on disk, they see the changes immediately.

## Compiling LaTeX

### Via API (preferred — gives you structured errors)

```bash
# Check if pdflatex is available
curl -s http://localhost:8420/api/latex/status
# → { "pdflatex_available": true, "bibtex_available": true, "biber_available": false }

# Compile a .tex file
curl -s -X POST http://localhost:8420/api/latex/compile \
  -H "Content-Type: application/json" \
  -d '{"path":"<vault-relative-path-to-file.tex>"}'
```

**Success response:**
```json
{ "ok": true, "pdf_path": "path/to/.compiled/file.pdf", "warnings": [...], "warning_count": 3 }
```

**Error response:**
```json
{ "ok": false, "errors": [{ "line": 42, "message": "Undefined control sequence", "full_context": "..." }], "log": "..." }
```

### Via command line (alternative)

```bash
cd <directory-containing-tex-file>
pdflatex -interaction=nonstopmode file.tex
bibtex file    # if using bibliography
pdflatex -interaction=nonstopmode file.tex
pdflatex -interaction=nonstopmode file.tex
```

The API method is preferred because it handles multi-pass compilation, bibtex/biber detection, temp directory management, and returns structured errors automatically.

## Fixing LaTeX Errors

When the user asks you to fix a LaTeX error:

1. **Compile via API** to get structured errors with line numbers
2. **Read the .tex file** and locate the error at the reported line
3. **Fix the error** — common issues:
   - `Undefined control sequence` → typo in command name, or missing `\usepackage{}`
   - `Environment X undefined` → missing package
   - `Missing $ inserted` → math outside math mode
   - `File not found` → missing `.sty`, `.cls`, or image file
4. **Save the file** — the user's editor updates automatically via SSE
5. **Recompile** to verify the fix

## File Structure

LaTeX projects typically contain:

| File | Purpose |
|------|---------|
| `main.tex` | Main document source |
| `references.bib` | BibTeX bibliography (`\cite{key}` references) |
| `*.sty` | Style packages (e.g., `neurips_2025.sty`) |
| `*.cls` | Document classes |
| `.compiled/` | Auto-generated — compiled PDFs (don't edit) |

All files must be in the same directory for compilation to work. The vault API serves `.tex`, `.bib`, `.cls`, `.sty`, `.bst` files.

## Compilation Details

- **Engine:** pdflatex (TeX Live)
- **Passes:** 3 passes automatically (resolves cross-references and citations)
- **Bibliography:** Automatic bibtex/biber detection (checks `.aux` for biblatex markers)
- **Timeout:** 30 seconds per pass
- **Output:** PDF saved to `.compiled/<filename>.pdf` next to the source

## Working with the User

- The user edits in the browser, you edit on disk — both see each other's changes in real-time
- The user can compile from the editor (Ctrl+Enter), or you can compile via the API
- When the user says "fix the error" or "compile this", use the API endpoint
- Citation autocomplete works in the editor — the user sees `.bib` keys when typing `\cite{`
- If `pdflatex` is not installed, the editor still works for editing — only compilation is unavailable
