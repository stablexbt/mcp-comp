# Landing Page Content

## Hero Section

### Headline
Ship Compliant AI Agent Payments in 10 Minutes

### Subheadline
REM is an MCP-native payment server with built-in KYT, Travel Rule, and policy controls. Open source. MIT license.

### CTA Buttons
- Get Started → GitHub repo
- See Demo → Link to demo video (when ready)

---

## Problem Section

### The Agent Payment Compliance Gap

When AI agents make payments, who's responsible for compliance?

Traditional payment systems assume a human is clicking "Buy Now." But when an agent decides to spend money, you need:

- **KYT (Know Your Transaction)**: Screen every transaction before it executes
- **Travel Rule**: Generate IVMS 101 packets for cross-border payments
- **Policy Controls**: Define rules about what agents can buy, how much, and from whom
- **Audit Trail**: Every agent decision and payment recorded with full context

Building all of this yourself takes 6–12 months. With REM, you get it in 10 minutes.

---

## Solution Section

### How REM Works

REM sits between your AI agent and the payment provider. Every payment request goes through three layers:

1. **Policy Engine**: Does this agent have permission to make this payment?
2. **KYT Check**: Is the transaction suspicious or on any watchlists?
3. **Travel Rule**: Does this cross-border payment need IVMS 101 compliance?

If all checks pass, the payment executes. If any fail, the agent gets a clear error with the reason.

---

## Features Section

### MCP-Native
Agents discover and use REM through standard MCP tools. No custom integrations.

### x402 Compliance
Built-in compliance wrapper for agent-initiated payments. Ship without regulatory risk.

### KYT Integration
Real-time transaction screening before execution. Stop suspicious payments before they happen.

### Travel Rule
IVMS 101 packet generation for cross-border payments. Meet regulatory requirements automatically.

### Policy Engine
Define and enforce payment rules per agent, amount, or destination. Full control over what agents can buy.

### Open Source
Core MCP server is MIT licensed. Use it for free, forever.

---

## Getting Started Section

### Quick Start

```bash
# Clone and run
git clone https://github.com/stablexbt/mcp-comp.git
cd mcp-comp
npm install
npm run dev
```

### MCP Configuration

```json
{
  "mcpServers": {
    "rem-payment-server": {
      "command": "npx",
      "args": ["rem-payment-server"]
    }
  }
}
```

### Register an Agent

```bash
curl -X POST http://localhost:3000/agent/register \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "complianceProfile": "standard"}'
```

---

## Pricing Section

### Open Source (Free)
- Core MCP server
- REST API
- Agent registration
- Policy engine
- Audit trail

### REM Pro ($499/mo)
- Everything in Open Source
- KYT integration
- Travel Rule compliance
- Advanced policy controls
- Priority support

---

## Footer

- GitHub: https://github.com/stablexbt/mcp-comp
- Twitter: @REM_Payments
- Discord: https://discord.gg/rem-payment-server
- Documentation: https://docs.rem-payment-server.dev (coming soon)
