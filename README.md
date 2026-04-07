# REM MCP Payment Server

Phase-1 MCP Payment Server for agent registration, payment processing, and policy-based compliance.

## What This Project Does

This server provides a complete payment infrastructure for AI agents with built-in compliance checks:

1. **Agent Registration** — Register AI agents with compliance profiles
2. **Payment Processing** — Send and receive payments between agents
3. **Policy Rules** — Create rules that automatically approve or block transactions
4. **Compliance Checking** — Real-time verification of transactions against policies
5. **Session Management** — Track agent sessions and transactions

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Server](#running-the-server)
- [API Quick Start](#api-quick-start)
- [Full API Documentation](#full-api-documentation)
- [Development](#development)
- [Testing](#testing)

---

## Prerequisites

Before you start, make sure you have these installed on your computer:

1. **Node.js** (version 18 or higher)
   - Check if you have it: Open terminal and run `node --version`
   - If not installed, download from: https://nodejs.org/

2. **npm** (comes with Node.js)
   - Check if you have it: Run `npm --version`

3. **Git** (optional, for cloning)
   - Check if you have it: Run `git --version`
   - Download from: https://git-scm.com/

---

## Installation

Follow these steps to install the project:

### Step 1: Get the Code

If you have Git:
```bash
git clone <repository-url>
cd rem-mcp-payment-server
```

If you downloaded a ZIP file:
1. Extract the ZIP file
2. Open terminal/command prompt
3. Navigate to the folder: `cd rem-mcp-payment-server`

### Step 2: Install Dependencies

Run this command in the project folder:

```bash
npm install
```

This will download all the required packages. Wait for it to finish (you'll see a progress bar).

### Step 3: Build the Project

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

You should see output showing files being compiled. This creates a `dist/` folder with the compiled code.

---

## Running the Server

### Option 1: Development Mode (Recommended for testing)

This mode automatically restarts the server when you change code:

```bash
npm run dev
```

You should see: `REM MCP Payment Server running on port 3000`

### Option 2: Production Mode

First build, then start:

```bash
npm run build
npm start
```

### Check if It's Working

Open your web browser or use curl:

```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "service": "rem-mcp-payment-server"
}
```

---

## API Quick Start

### 1. Register an Agent

Create a new AI agent with compliance settings:

```bash
curl -X POST http://localhost:3000/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "My Trading Agent",
      "type": "trading",
      "owner": "user@example.com"
    },
    "compliance": {
      "riskLevel": "medium",
      "geoRestrictions": ["US", "EU"],
      "allowedPaymentMethods": ["card", "bank_transfer"],
      "maxTransactionAmount": 10000,
      "dailyTransactionLimit": 50000
    }
  }'
```

Save the `agentId`, `apiKey`, and `apiSecret` from the response - you'll need them!

### 2. Create a Policy Rule

Set up a rule that blocks large transactions:

```bash
curl -X POST http://localhost:3000/policy/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Block Large Transactions",
    "type": "transaction_limit",
    "action": "block",
    "conditions": {
      "maxAmount": 5000
    }
  }'
```

### 3. Evaluate a Transaction

Check if a transaction would pass the policies:

```bash
curl -X GET http://localhost:3000/policy/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "amount": 1000,
      "currency": "USD",
      "sender": {
        "id": "agent_123",
        "type": "agent"
      },
      "recipient": {
        "id": "agent_456",
        "type": "agent"
      }
    }
  }'
```

### 4. Process a Payment

Send a payment between agents:

```bash
curl -X POST http://localhost:3000/agent/payment \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET" \
  -d '{
    "recipientId": "agent_456",
    "amount": 100,
    "currency": "USD"
  }'
```

---

## Full API Documentation

### Agent Endpoints

#### POST /agent/register
Register a new AI agent.

**Request Body:**
```json
{
  "metadata": {
    "name": "string",
    "type": "string",
    "owner": "string"
  },
  "compliance": {
    "riskLevel": "low|medium|high",
    "geoRestrictions": ["US", "EU"],
    "allowedPaymentMethods": ["card", "bank_transfer"],
    "maxTransactionAmount": 10000,
    "dailyTransactionLimit": 50000
  }
}
```

#### POST /agent/payment
Process a payment between agents.

**Headers:**
- `X-API-Key`: Your API key
- `X-API-Secret`: Your API secret

**Request Body:**
```json
{
  "recipientId": "string",
  "amount": 100,
  "currency": "USD"
}
```

#### GET /agent/:id
Get agent details.

### Policy Endpoints

#### POST /policy/rules
Create a new policy rule.

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "type": "transaction_limit|geo_restriction|counterparty_restriction|velocity_limit|time_window",
  "action": "allow|block|flag|review",
  "conditions": {
    "maxAmount": 5000,
    "minAmount": 1,
    "currency": "USD",
    "allowedCountries": ["US", "EU"],
    "blockedCountries": ["XX"],
    "maxTransactionsPerDay": 10,
    "maxAmountPerDay": 10000
  }
}
```

#### GET /policy/rules
List all policy rules.

#### GET /policy/rules/:id
Get a specific policy rule.

#### GET /policy/evaluate
Evaluate a transaction against all active policies.

**Request Body:**
```json
{
  "transaction": {
    "amount": 100,
    "currency": "USD",
    "sender": {
      "id": "string",
      "type": "agent|wallet|address"
    },
    "recipient": {
      "id": "string",
      "type": "agent|wallet|address"
    }
  }
}
```

### Compliance Endpoints

#### POST /compliance/verify
Verify compliance for a transaction.

#### GET /compliance/status/:agentId
Get compliance status for an agent.

---

## Development

### Project Structure

```
rem-mcp-payment-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── routes/               # API route handlers
│   │   ├── agent.ts
│   │   ├── compliance.ts
│   │   └── policy.ts
│   ├── services/             # Business logic
│   │   ├── agentService.ts
│   │   ├── complianceService.ts
│   │   ├── paymentService.ts
│   │   ├── policyService.ts
│   │   ├── sessionService.ts
│   │   └── transactionService.ts
│   ├── store/                # Data storage
│   │   ├── agentStore.ts
│   │   ├── sessionStore.ts
│   │   └── transactionStore.ts
│   └── types/                # TypeScript type definitions
│       ├── agent.ts
│       ├── compliance.ts
│       └── policy.ts
├── tests/                    # Test files
├── dist/                     # Compiled JavaScript (auto-generated)
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

### Making Changes

1. Edit files in the `src/` folder
2. The server will auto-restart if running in dev mode (`npm run dev`)
3. Run tests to make sure nothing broke: `npm test`

### Environment Variables

You can set these optional environment variables:

```bash
PORT=3000  # Change the server port (default: 3000)
```

On Linux/Mac:
```bash
export PORT=8080
npm run dev
```

On Windows:
```cmd
set PORT=8080
npm run dev
```

---

## Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode (re-runs when files change):

```bash
npm test -- --watch
```

---

## Troubleshooting

### Port Already in Use

If you see `Error: listen EADDRINUSE: address already in use :::3000`:

1. Find what's using port 3000:
   - Mac/Linux: `lsof -i :3000`
   - Windows: `netstat -ano | findstr :3000`

2. Either stop that process or use a different port:
   ```bash
   PORT=8080 npm run dev
   ```

### Build Errors

If `npm run build` fails:

1. Delete the `dist` folder: `rm -rf dist`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Try building again: `npm run build`

### Module Not Found Errors

Make sure you ran `npm install` in the project folder (not a parent folder).

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the test files in `tests/` folder for usage examples
- Open an issue in the GitHub repository
