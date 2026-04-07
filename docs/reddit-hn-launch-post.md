# Reddit / Hacker News Launch Post

## Title (HN)
Show HN: REM — x402-Compliant MCP Payment Server for AI Agents

## Title (Reddit r/MachineLearning)
[R] REM Payment Server — Ship Compliant AI Agent Payments in 10 Minutes (Open Source MCP Server)

## Title (Reddit r/programming)
Open sourcing REM: MCP payment server with built-in KYT and Travel Rule compliance for AI agents

---

## Post Body

Hey HN/Reddit,

We built REM, an open-source MCP server that lets AI agents make compliant payments without building compliance infrastructure from scratch.

**The problem:** AI agents are starting to make payments (buying APIs, subscribing to services), but most implementations have zero compliance — no transaction screening, no audit trail, no policy controls. When agents start spending real money, this becomes a regulatory liability.

**The solution:** REM sits between your agent and payment provider. Every payment goes through:
1. Policy engine — Can this agent make this payment?
2. KYT screening — Is the transaction suspicious?
3. Travel Rule — Does this cross-border payment need IVMS 101?

If all checks pass, payment executes. If any fail, clear error with reason.

**MCP-native:** Drop it into your MCP config and your agent gets payment tools automatically.

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

**Tech stack:** TypeScript, Node.js, Express, MCP SDK

**Open source:** MIT license, core server is free forever.

**What's included:**
- 8 MCP tools for agent payments and compliance
- Full REST API
- Agent registration with compliance profiles
- Policy engine with configurable rules
- Audit trail for every transaction

**Links:**
- GitHub: https://github.com/stablexbt/mcp-comp
- Docs: See README

Happy to answer questions about MCP, x402 compliance, or agent payments in general.
