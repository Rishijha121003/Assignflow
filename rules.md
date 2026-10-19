AssignFlow --- Project Working Rules
These rules govern all code changes in AssignFlow. Follow them on every
task. If the repository has a supported agent instruction file (for
example, AGENTS.md), keep a short pointer there telling the agent to
read this file before work begins. Do not assume RULES.md is
automatically loaded unless the tool's instruction-loading behavior
confirms it.
1. Scope First --- Avoid Repository-Wide Analysis by Default
- Identify the exact bug, feature, or behavior requested.
- Start with targeted searches for relevant symbols, routes,
  components, endpoints, and tests.
- Do not scan or summarize the entire repository for a localized task.
- Inspect only the target code and the direct dependencies required to
  understand the execution path.
- Expand scope only when evidence shows the issue crosses module
  boundaries.
2. Trace the Relevant Execution Path Before Editing
Trace only what the task requires, typically:
1. UI entry point, event handler, or page.
2. Relevant state and form handling.
3. API request and request/response contract.
4. Backend endpoint, validation, and service logic.
5. Model/database relationship, only when relevant.
6. Focused tests covering the behavior.
Do not inspect unrelated authentication, analytics, notifications,
grading, or other modules unless they are actually connected to the
affected flow.
3. Necessity Check --- Challenge Every Proposed Change
Before making each meaningful change, ask:
1. What specific problem or confirmed requirement does this solve?
2. Is the problem supported by code, reproducible behavior, a test, or
   an explicit requirement?
3. Does the existing implementation already satisfy the requirement?
4. Is a change actually necessary?
5. What is the smallest safe solution?
6. What existing behavior, API, data, security property, or workflow
   could this affect?
7. Can the same outcome be achieved without another file, function,
   dependency, abstraction, configuration option, migration, or UI
   element?
Rules: - If the requirement is already satisfied, do not change the
code. - If a proposed change is speculative, redundant, cosmetic without
user value, or unrelated, skip it and explain why. - Prefer no change
over an unnecessary change. - Prefer the smallest safe fix over a broad
rewrite. - Do not add features merely because they might be useful
later. - Do not refactor unrelated code while fixing a bug. - Do not
change working code just to match personal style preferences. - If a
broader change is genuinely required for security, correctness, or data
integrity, make the case with evidence rather than artificially limiting
the scope.
4. Reuse Findings, Avoid Repeated Investigation
- Reuse relevant findings already established in the current task.
- Do not repeat searches or reread the same code when its current
  contents and relevant details are already available.
- Use previous reports to identify likely files and functions, then
  verify those areas if code may have changed.
- Never treat an old report as proof that the current implementation
  is correct.
- Do not repeatedly run the same expensive checks without a reason.
5. Make the Smallest Safe Change
- Identify the root cause before editing.
- Change only the files and functions required by the confirmed
  solution.
- Preserve existing API contracts, schemas, UI conventions,
  authorization, validation, and working behavior.
- Reuse existing helpers and patterns where appropriate.
- Avoid unrelated formatting, renaming, cleanup, or architecture
  changes.
- Do not introduce dependencies, abstractions, migrations, or new
  configuration unless necessary.
- Do not silently change defaults or product behavior.
- If a change would alter an important product decision or has
  significant trade-offs, explain the options and ask before
  proceeding.
- Keep changes consistent with the current project architecture unless
  the task explicitly authorizes architectural work.
6. AssignFlow Product and Data Integrity Rules
- The global Assignments page is the overview and management view
  across classes and subjects.
- A subject-specific Assignments tab shows only assignments belonging
  to that subject.
- Both entry points should use the same underlying creation workflow
  and backend behavior where appropriate; do not create duplicate
  implementations or duplicate records.
- In a class-scoped workflow, show only subjects actually associated
  with the selected class. Never fall back to unrelated global
  subjects, hardcoded subject lists, or an arbitrary "Other" option.
- When creating from a subject page, preserve the intended class and
  subject context and validate it on the server.
- Derive semester information from the class relationship. Semester is
  optional for independent classes, school workflows, and coaching
  workflows. Never display a raw database ID as a semester name.
- Preserve teacher/student role boundaries, class enrollment checks,
  student privacy, and draft-grade visibility rules.
- Draft assignments must remain hidden from students until published,
  according to the existing product behavior.
- Keep grade release explicit. Do not expose draft grades or change
  release semantics accidentally.
- Preserve existing safe submission-policy defaults unless the user
  explicitly approves a change: reject late submissions by default and
  require teacher approval for resubmission by default.
- Preserve submission history, grade-correction history, re-evaluation
  history, and audit requirements. Before deleting or replacing
  files/records, confirm the existing history and retention
  requirements.
- Validate class-subject ownership and authorization on the server,
  not only in the frontend.
- Do not run destructive data cleanup or change database records
  without explicit authorization.
- Do not introduce a new database relationship or migration simply
  because it looks cleaner. First evaluate current constraints,
  existing data, migration risk, and whether a smaller validation fix
  is sufficient.
7. Verification --- Proportional to the Change
Run the smallest useful checks first:
- Frontend-only change: run the relevant frontend assembly/build/check
  and focused tests.
- Backend-only change: run focused endpoint/service/model tests.
- Shared behavior, authorization, submissions, grading, data
  integrity, or security changes: run focused tests and broader
  regression tests when practical.
- Run the full suite when the impact warrants it, not automatically
  after every tiny edit.
- Use browser verification only when a real browser interaction was
  completed.
- Never claim a test, build, browser check, or database audit ran
  unless it actually ran.
- Report exact commands and actual outcomes, including failures and
  checks not run.
- If a test fails, investigate whether the failure is caused by the
  change before declaring success.
8. Security and Sensitive Information
- Do not print, expose, or unnecessarily inspect passwords, password
  hashes, access tokens, API keys, cookies, or other secrets.
- Do not weaken authentication, authorization, input validation,
  upload validation, file access controls, or security configuration
  to make a test pass.
- Treat user input and uploaded files as untrusted.
- Preserve safe file storage, access control, and cleanup behavior.
- Do not disclose private student records or data in logs and reports.
9. Data, Git, and Deployment Safety
- Never modify or delete user data unless the task explicitly
  authorizes it.
- Do not run destructive database commands, data repairs, or
  migrations without authorization and an explained plan.
- Never commit, push, tag, publish a release, or deploy unless the
  user explicitly requests that action.
- Do not alter .env, secrets, or environment configuration
  unnecessarily.
- Do not overwrite user work or revert unrelated changes.
10. Efficient Task Workflow
For each task:
1. Restate the specific requested outcome internally; do not produce a
   long plan unless requested.
2. Search for the relevant symbols and entry point.
3. Trace the necessary execution path.
4. Check necessity and choose the smallest safe solution.
5. Implement directly when the requirement is clear; do not stop at
   analysis unnecessarily.
6. Run focused verification, then expand only when warranted.
7. Review the diff for accidental or unrelated changes.
8. Report the result concisely.
Ask the user only when a critical requirement is ambiguous, a
significant product decision is needed, or a potentially destructive
action is being considered. Do not ask for permission for routine,
reversible, in-scope code edits when the requirement is clear.
11. Required Final Report
At the end of each task, provide:
- Problem/root cause: What was wrong or what requirement was
  missing.
- Necessity: Why a change was needed, or why no change was made.
- Changes: Files and functions modified and a concise summary.
- Minimality: Why the solution is the smallest reasonable one.
- Verification: Exact commands and actual results.
- Remaining risks: Anything not verified or still unresolved.
- Skipped changes: Any unnecessary improvements intentionally left
  untouched.
Keep the report concise. Do not provide a full repository summary unless
requested.
Golden Rule
Every change must justify its existence. Confirm the problem,
inspect only the relevant code, make the smallest safe change, and
verify the affected behavior. Prefer no change over an unnecessary
change.