# CAPA Workshop Central

A separate, runnable CAPA website inspired by Sisober's green safety-operations interface. The original local workspace includes eight workbook findings and their photos. This public source repository excludes inspection records, evidence, credentials and screenshots. A fresh clone starts with an empty register.

## Run

Requires Node.js 22 or newer. No package installation is needed.

```powershell
cd D:\Iren
npm start
```

Open http://localhost:3100. The server listens only on the local computer.

## Features

- Dashboard totals, overdue tracking in the Asia/Makassar timezone, closure progress and PIC distribution.
- Search and status/PIC filters; filtered CSV export with spreadsheet formula-injection protection.
- Create and edit findings, recommendations, root causes, corrective actions and preventive actions.
- Original inspection photos plus corrective evidence uploads (JPG, PNG or PDF, maximum 8 MB).
- Open → In progress → Pending verification → Closed; verification can return a finding for revision, and closed findings can be reopened with a reason.
- Submission requires corrective action and evidence. Closure, return for revision and reopening require notes.
- Activity history, server-side validation, stale-edit conflict detection and file persistence across restarts.
- Responsive Indonesian interface and accessible native dialogs.

## Data and backups

`data/seed.json` is the source import. On the first change, the app writes `data/records.json` and uses that file on later starts. Back up that file and `public/evidence/` together. Writes use an atomic rename. Run one server process per data file. The original workbook is not modified; website edits do not sync back to it.

The importer in `scripts/import_workbook.py` reads the exact supplied workbook schema and resolves both floating and rich-value in-cell images. It is an extraction utility for this workbook, not a general spreadsheet import interface. The workbook's seven cached `#VALUE!` photo cells were resolved to their actual embedded images. The original dates are 1 September 2026 (inspection), 20 September 2026 (seven deadlines), and 1 October 2026 (one deadline).

## Validation

```powershell
npm test
```

Integration coverage includes workflow gates, evidence validation, edit conflicts, date validation, closure, reopening, record creation and persistence after a server restart. Tests use synthetic fixtures in an isolated temporary data file.

## Deployment scope

This is a local single-workspace application. Actions are not authenticated or restricted by role, and the history identifies actions rather than verified people. For shared online use, add authenticated accounts, PIC/verifier authorization, a shared database, managed evidence storage and backups. Do not expose this local server publicly as a multi-user system. No Sisober credentials, database or application files are used or modified.

Vercel deployment is pending hosted storage and authentication setup. The local server explicitly refuses to run when `VERCEL` is set so it cannot accidentally publish an unauthenticated file-based backend.
