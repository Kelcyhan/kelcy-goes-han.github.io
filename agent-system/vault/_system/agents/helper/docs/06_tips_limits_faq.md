# Tips, Limits & FAQ

## Best Practices

### Talk to agents like colleagues, not search engines

Agents understand context. You can say:
> "I want to continue the literature review from last week, but this time focus on empirical results rather than theory"

And they'll understand. You don't need to spell everything out from scratch each time.

### When in doubt, just ask

If you're not sure how to do something — just ask the agent. It knows your entire project, all your files, and how the system works. "How should I structure this?" is a perfectly valid thing to say.

### Give agents specific tasks, not vague missions

| ❌ Vague | ✅ Specific |
|----------|------------|
| "Research AI" | "Find 5 papers on LLM agent architectures from 2023-2025 and summarize each in 2 sentences" |
| "Fix the code" | "The login function on line 42 returns a 403 error when the email contains a + sign. Find and fix it." |
| "Write the paper" | "Write the related work section (600 words) covering multi-agent coordination approaches. Cite 4-5 of the papers in our library." |

### Keep sessions focused

One agent, one area of work. If you're writing a paper and want to also debug code, start a second session for the coding. Mixed-context sessions produce worse results.

### Check in regularly

Agents may complete work or hit a decision point while you're away. A quick check of the notification panel and session status dots takes 10 seconds and keeps work moving.

### Start fresh when context gets heavy

After a long session, agents may start getting slightly less sharp. For a new piece of work — especially something unrelated to what you've been doing — start a new session. The agent will load your project state fresh.

---

## Known Limitations

**This is an alpha.** Things will occasionally break. When they do, please report them using this Helper Bot or by telling an agent directly.

| Limitation | What to do |
|-----------|------------|
| **Agents can be slow on complex tasks** | This is expected — complex plans take time. You can check the terminal tab to see what's happening. |
| **Very long sessions may degrade** | Start a new session for a fresh start |
| **Verification isn't perfect** | Especially for non-code tasks, the automatic check may be too strict or too lenient. Review outputs yourself. |
| **Search may miss recent files** | The index updates every few minutes. If you can't find a very recent file, wait 2-3 minutes and try again. |
| **File edits by multiple agents at once** | Avoid having two agents edit the same file simultaneously — they may overwrite each other. |
| **Voice input requires microphone permission** | If the mic icon is grayed out, your browser needs permission to access the microphone. Click the lock icon in your browser's address bar. |

---

## FAQ

**How do I stop an agent?**
Click the session in the left sidebar → click the **⋯ menu** → "Close session". The agent will finish its current sentence and shut down cleanly.

**Can I undo what an agent did?**
Agent work is saved as files in your project. For most changes, you can ask an agent to revert: "Undo the changes you made to the proposal document." For file deletions, recovery may not be possible — so be careful when asking agents to delete things.

**What if the agent's plan is wrong?**
Reject it in the approval notification and explain what you want instead. "This looks good but skip step 3 — I'll handle that part myself" is fine. The agent will revise and propose again.

**How do I find something I was working on last week?**
Use search (Cmd/K). You can search by task name, file content, or describe what you're looking for. Past agent sessions are also browsable in the session panel — scroll down to see older ones.

**Can agents work while I close the browser?**
Yes. Agents run on the server, not in your browser. Close the tab, shut your laptop — they'll keep working. When you come back, open the dashboard and check the session panel for results.

**How do I give feedback about the system?**
Click the 💬 Helper Bot button (bottom-left). That's me — I'll gather your feedback, ask a follow-up question if needed, and make sure it gets to the right place.

Or: tell any agent directly in the chat. "The verification step is too strict for research tasks" — the agent will log this for the developers.

**What if two agents are working on the same task?**
That's unusual, but possible. Check the session panel — if you see two green dots on related tasks, and they seem to be duplicating work, close one of the sessions and tell the other to continue.

**Something crashed — what do I do?**
1. Refresh the browser
2. Check if your sessions are still visible in the left panel
3. If sessions are gone, start a new concierge session and say "I think something crashed — what was I working on?" The concierge will check recent history and help you pick up.
4. Report the crash using the 💬 Helper Bot

**How do I share my work with others?**
Currently, this system is personal — single-user. Sharing features are coming. For now, export your files (download button in the viewer) and share them manually.
