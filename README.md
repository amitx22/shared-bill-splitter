# 💸 SplitMate – Shared Bill Splitter

**SplitMate** is a full-stack shared expense management application designed to simplify household expense tracking. It allows users to create a home, add members, split bills equally, track individual payments, and calculate outstanding balances.

The application focuses on accurate monetary calculations, reliable payment processing, and persistent data storage.

---

## 🚀 Features

- **Home Management:** Create a home to organize shared expenses.
- **Member Management:** Add and manage members within a home.
- **Smart Bill Splitting:** Automatically divide bills equally among all members.
- **Accurate Calculations:** Uses integer arithmetic (cents/paise) to avoid floating-point precision errors.
- **Remainder Distribution:** Distributes extra cents fairly in member-addition order.
- **Payment Tracking:** Mark individual member shares as paid.
- **Idempotent Payments:** Uses idempotency keys to prevent duplicate payment processing.
- **Outstanding Balances:** Calculate and display each member's unpaid amount.
- **Data Persistence:** Stores application data in Cloudflare D1 and restores the current home after a browser refresh using local storage.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React, Vite, TypeScript |
| Routing | TanStack Router |
| Backend | Hono |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Package Manager | pnpm |
| Testing | Vitest |
| Code Quality | Biome |

---

## 📁 Project Structure

```text
shared-bill-splitter/
│
├── api/
│   ├── migrations/
│   │   └── 0001_init.sql
│   └── src/
│       └── index.ts
│
├── web/
│   └── src/
│       └── routes/
│           └── index.tsx
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- A configured Cloudflare D1 database

### 1. Clone the Repository

```bash
git clone https://github.com/amitx22/shared-bill-splitter.git

cd shared-bill-splitter
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Cloudflare D1

Configure your Cloudflare D1 database and the required environment bindings in the API's Wrangler configuration.

Apply the database migration to your local or remote D1 database according to your environment.

### 4. Start the Application

Start both the backend API and frontend development servers together:

```bash
pnpm dev
```

Open the frontend URL displayed in your terminal by Vite.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check API health |
| POST | `/api/homes` | Create a new home |
| GET | `/api/homes/:homeId` | Retrieve complete home data |
| POST | `/api/homes/:homeId/members` | Add a member |
| POST | `/api/homes/:homeId/bills` | Create and split a bill |
| GET | `/api/homes/:homeId/balances` | Retrieve outstanding balances |
| POST | `/api/bills/:billId/shares/:shareId/pay` | Mark a share as paid |

---

## 🧠 Key Technical Decisions

### 1. Integer-Based Money Calculations

All monetary values are stored as integer cents/paise instead of floating-point numbers.

This avoids precision errors during bill calculations.

When a bill cannot be divided equally, the remaining cents are distributed one by one in member-addition order, ensuring that the total of all shares exactly matches the original bill amount.

### 2. Idempotent Payment Processing

Payment requests require an `Idempotency-Key` header.

The key is stored alongside the payment record to ensure that retrying the same request does not process the same payment twice.

Database batch operations are used to keep the share update and idempotency record together.

### 3. Persistent Data and Session Restoration

Cloudflare D1 is used to persist homes, members, bills, shares, and payment records.

The frontend stores the current home ID in browser local storage and retrieves the associated data from the API after a page refresh.

This allows users to continue working with their existing home without creating it again.

---

## 🧪 Testing & Quality Checks

The project uses Vitest for automated API testing and Biome for code quality checks.

Run the following commands from the project root:

| Command | Purpose |
|---|---|
| `pnpm check` | Run Biome checks |
| `pnpm typecheck` | Check TypeScript types |
| `pnpm test` | Run API automated tests |
| `pnpm build` | Build the frontend for production |
| `pnpm check:fix` | Automatically fix Biome issues |
| `pnpm format` | Format source files |
| `pnpm lint` | Run Biome lint checks |

### Run All Verification Commands

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

---

## 🤖 AI Tools Disclosure

AI tools were used as development assistance for:

- Understanding project requirements.
- Debugging and resolving implementation issues.
- Reviewing code and improving implementation quality.
- Structuring and improving project documentation.

The implementation was integrated, tested, and verified as part of the development process.

---

## 👨‍💻 Author

**Amit Kumar**

- GitHub: [@amitx22](https://github.com/amitx22)
- Project Repository: [Shared Bill Splitter](https://github.com/amitx22/shared-bill-splitter)

---

<p align="center">
  <b>Built with ❤️ using React, Hono, TypeScript and Cloudflare D1.</b>
</p>
