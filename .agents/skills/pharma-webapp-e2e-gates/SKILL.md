---
name: pharma-webapp-e2e-gates
description: Plan reproducible Playwright browser QA across RTL ERP, commerce and mobile responsive breakpoints.
---

# Browser and device QA

Use the repository's existing Playwright/Vitest commands. Never claim tests ran merely because test code exists. Original upstream inspiration: https://github.com/anthropics/skills/tree/main/skills/webapp-testing

For each test, record commit SHA, base URL, branch, browser/device, screenshot/video path, command, result and last-verified timestamp. Use seeded fake data.

**YmPharma:** keyboard-first invoice grid and Tab flow; RTL focus; FEFO and batch expiry warnings; returns and posted-journal immutability; branch role segregation; offline POS for 12h simulated quota; reconnect/replay and exact-once behavior; Windows/Android/iPad breakpoints.

**muslly.com:** navigation, PDP images, 404, guest/auth cart persistence boundaries, server-authoritative quote, prescription guard, duplicate submit, a11y keyboard navigation, RTL rendering, responsive mobile and checkout failures.

**Gate:** `PASS` only from recent logs for exact environment; otherwise `FAIL`, `BLOCKED`, or `NOT_RUN`. A responsive browser check does not certify a native app or real device.
