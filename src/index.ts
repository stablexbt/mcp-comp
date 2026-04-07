import express from 'express';
import { agentRoutes } from './routes/agent';
import { complianceRoutes } from './routes/compliance';
import { policyRoutes } from './routes/policy';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rem-mcp-payment-server' });
});

// Agent routes
app.use('/agent', agentRoutes);

// Compliance routes
app.use('/compliance', complianceRoutes);

// Policy routes
app.use('/policy', policyRoutes);

app.listen(PORT, () => {
  console.log(`REM MCP Payment Server running on port ${PORT}`);
});

export default app;
