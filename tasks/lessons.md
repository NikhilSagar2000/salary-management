# Lessons

Rules learned from Nikhil's corrections and preferences. Read at session start.

1. **Ask instead of assuming.** Nikhil said "Dont assume anything. in doubt? always ask me"
   (P2). For any choice the requirements leave open, ask with a recommended option first.
2. **Leave room for free-form answers.** He sometimes declines multiple-choice dialogs to
   type his own context (Q7/Q8, P3). When he declines a dialog, ask in plain text and wait.
3. **Check the requirements for contradictions before encoding a rule.** "Red commit" vs
   "commit only when tests pass" needed his call (Q34), not my interpretation.
4. **Push back with numbers when an answer has a hidden cost.** "Let the model compute
   everything" (Q21) ran into context size and arithmetic accuracy. Laying out the problem
   led to a better choice (Q25).
5. **One test run at a time, and stop on failure.** Two Vitest runs shared the test database,
   killed runs left Postgres sessions holding locks, and a `;`-chained command committed after a
   failing run. Chain with `&&`, check `pgrep -f "vitest run"` before running, and terminate
   orphaned `acme_test` sessions after killing a run.
6. **A constant "hang" length is a clue.** Test stalls of ~926 s every time matched the Mac's
   925–926 s maintenance-sleep cycles in `pmset -g log`, not the code. Check the host before
   chasing database theories, and run long commands under `caffeinate -i`.
