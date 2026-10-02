# Agent team (3 roles)

Use these agents by enabling the matching rule in Cursor (rule picker) or mentioning the role in your prompt.

| Agent | Rule file | When to use |
|-------|-----------|-------------|
| **Strategist** | `agent-strategist.mdc` | Scope, architecture, trade-offs, splitting work, API and data flow design before coding. |
| **Builder** | `agent-builder.mdc` | Implementation: TypeScript, React, Electron desktop, Chrome extension, shared packages. |
| **Reviewer** | `agent-reviewer.mdc` | Pre-merge review: correctness, security, UX/accessibility, tests, consistency with repo patterns. |

Suggested flow for larger tasks: Strategist → Builder → Reviewer.
