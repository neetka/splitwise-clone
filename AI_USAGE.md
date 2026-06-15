1. AI Tools Used

During the development of this project, the following AI tools were used to assist in coding, debugging, design, and optimization:

1. ChatGPT (OpenAI)
Used for backend logic generation (Node.js + Express controllers)
Prisma schema debugging and optimization
CSV parsing and anomaly detection logic design
Writing commit-ready production code blocks
2. GitHub Copilot
Assisted in auto-completing repetitive frontend components
Suggested boilerplate API calls and React hooks
Helped speed up UI development in dashboard pages
3. Stack Overflow + AI-assisted search
Used for resolving runtime errors in Prisma queries
Fixing CORS and authentication token issues
Debugging CSV parsing edge cases
2. Key Prompts Used

Below are some actual prompts used during development:

Prompt 1 (Backend Logic Generation)

"Build a Node.js controller that imports CSV expenses into a database, detects anomalies like missing fields, duplicate entries, invalid currency, and handles split calculations."

Prompt 2 (Prisma Debugging)

"Why is my Prisma createMany failing when I pass Decimal fields and how to fix type conversion issues?"

Prompt 3 (CSV Parsing)

"Parse a CSV file in Node.js using csv-parser and validate each row with custom rules like date format, negative amount, and split mismatch."

Prompt 4 (Frontend UI Fix)

"Improve this dashboard UI built with React + Tailwind to make it modern, clean, and similar to a fintech expense tracker with better spacing and hierarchy."

3. AI Mistakes Observed & Fixes
Case 1: Incorrect Date Parsing Logic
AI Output Issue: Initially suggested using new Date(string) for all formats.
Problem: Failed for DD-MM-YYYY format and caused invalid dates.
Fix Applied: Implemented custom parser:
Split string manually
Converted to YYYY-MM-DD before parsing
Added fallback validation flag
Case 2: Decimal Precision Loss in Prisma
AI Output Issue: Suggested using plain JavaScript number for money values.
Problem: Caused floating-point precision errors (e.g., 10.1 + 0.2 ≠ 10.3).
Fix Applied:
Switched to Decimal from Prisma
Added round2() utility for consistent rounding
Ensured all DB writes use Decimal-safe values
Case 3: Duplicate Detection Logic Too Strict
AI Output Issue: Suggested strict equality matching for detecting duplicates.
Problem: Missed near-duplicate expenses (e.g., "Lunch" vs "Lunch - team").
Fix Applied:
Added fuzzy matching using normalized strings
Ignored special characters and case differences
Combined title + amount + date similarity scoring
4. Summary of AI Role in Project

AI was used as a development accelerator, not a replacement. It helped:

Speed up backend architecture design
Reduce debugging time significantly
Improve data validation logic
Enhance overall system robustness

However, all critical business logic was:

Verified manually
Tested with edge cases
Modified to fit real-world constraints