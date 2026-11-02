SplitMate 💸 – Shared Bill Splitter

SplitMate is a full-stack shared expense management application that helps people manage household expenses, split bills among members, track payments, and calculate outstanding balances.

🚀 Features

- Home Management: Create a home to manage shared expenses.
- Member Management: Add members to a home.
- Bill Splitting: Split bills equally among all members.
- Accurate Calculations: Uses integer arithmetic (cents/paise) to avoid floating-point rounding errors.
- Payment Tracking: Mark individual member shares as paid.
- Idempotent Payments: Uses idempotency keys to prevent duplicate payment processing.
- Outstanding Balances: View the unpaid amount for each member.
- Data Persistence: Home data is stored in Cloudflare D1, and the home ID is saved in browser local storage to restore the session after refresh.

🛠️ Tech Stack

Frontend

- React
- Vite
- TypeScript
- TanStack Router

Backend

- Hono
- Cloudflare Workers
- Cloudflare D1 (SQLite)

Development & Testing

- pnpm
- Vitest
- Biome

📁 Project Structure

shared-bill-splitter/
├── api/
│   ├── migrations/
│   │   └── 0001_init.sql
│   └── src/
│       └── index.ts
├── web/
│   └── src/
│       └── routes/
│           └── index.tsx
├── package.json
├── pnpm-workspace.yaml
└── README.md

⚙️ Getting Started

Prerequisites

- Node.js
- pnpm
- Cloudflare Wrangler
- Configured Cloudflare D1 database

1. Clone the repository

git clone https://github.com/amitx22/shared-bill-splitter.git
cd shared-bill-splitter

2. Install dependencies

pnpm install

3. Configure Cloudflare D1

Configure your D1 database and the required environment bindings in the API's Wrangler configuration.

Apply the database migration to your local or remote D1 database as appropriate for your environment.

4. Start the application

Run both API and frontend development servers together:

pnpm dev

Open the frontend URL displayed by Vite in your terminal.

🧪 Testing & Quality Checks

Run these commands from the project root:

Command| Purpose
"pnpm check"| Biome lint and formatting checks
"pnpm typecheck"| TypeScript type checking
"pnpm test"| API automated tests
"pnpm build"| Frontend production build
"pnpm check:fix"| Automatically fix Biome issues
"pnpm format"| Format source files
"pnpm lint"| Run Biome lint checks

Run all required verification commands:

pnpm check
pnpm typecheck
pnpm test
pnpm build
 
These commands check code formatting and linting, TypeScript correctness, automated tests, and production builds.

🤖 AI Tools Disclosure

AI tools were used as development assistance for understanding requirements, debugging, reviewing implementation, and improving documentation.

All implementation decisions, code integration, testing, and final verification were performed as part of the project development process.

👨‍💻 Author

Amit Kumar

GitHub: "@amitx22" (https://github.com/amitx22)

Project Repository: "Shared Bill Splitter" (https://github.com/amitx22/shared-bill-splitter)