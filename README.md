# CP Failed Case Helper

This project gives you:

1. A browser extension to:
   - extract failed-case details (`failing test index`, `expected`, `actual`, optional input text)
   - scrape sample tests from CP problem pages and download them as `tests.json`
2. A local test runner script that behaves like CPH-style testing:
   - runs all tests against your program
   - prints pass/fail per test
   - prints full JSON of first failing test with `input`, `expected`, `actual`

## 1) Load the extension

1. Open Chrome/Edge and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select folder: `cp-helper-extension/extension`

Supported websites (best effort):
- Codeforces
- AtCoder
- CodeChef

## 2) Extract failed details

Open your submission/error page and click the extension icon:

- **Extract failed case**: tries to parse message like
  - `26th input gives result 8 and my output is 9`
  - output includes:
    - `failingTestIndex: 26`
    - `expectedOutput: 8`
    - `yourOutput: 9`
- **Copy as JSON**: copies extracted data for quick use in your code/debug notes.

## 3) Export sample tests

On a problem page:

- Click **Scrape sample tests**
- Click **Download tests.json**

## 4) Run all tests in VS Code terminal

From `cp-helper-extension`:

```bash
node scripts/run-tests.js tests.json "python3 solution.py"
```

or C++:

```bash
node scripts/run-tests.js tests.json "./a.out"
```

Output includes the first failing case in machine-readable JSON:

```json
{
  "index": 26,
  "input": "...",
  "expected": "8",
  "actual": "9"
}
```

## 5) VS Code task

A task is included at:

- `.vscode/tasks.json`

You can run it with **Run Task**:

- `CP: Run all tests from tests.json`

Edit command in that file to match your language/run command.

## Notes

- This extension is intentionally best-effort because each judge website formats verdict text differently.
- If a site blocks direct extraction of hidden failing input, you still get parsed index/expected/actual from the visible error message.
