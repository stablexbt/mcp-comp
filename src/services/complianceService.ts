import { v4 as uuidv4 } from 'uuid';
import {
  KytTransactionDetails,
  KytScreeningRequest,
  KytScreeningResult,
  KytScreeningResponse,
  KytRiskFlag,
  KytRiskLevel,
  KytScreeningStatus,
  SanctionsCheckResult,
  GeographyCheckResult,
  AmountCheckResult,
  HIGH_RISK_JURISDICTIONS,
  PROHIBITED_JURISDICTIONS,
  SanctionsEntry,
  WatchlistEntry,
  TravelRuleRequest,
  TravelRuleResult,
  TravelRuleResponse,
  TravelRuleFlag,
  TravelRuleStatus,
  IvmsTransaction,
  IvmsOriginator,
  IvmsBeneficiary,
  IvmsPerson,
} from '../types/compliance';

// In-memory sanctions list (in production, this would be a proper database)
const sanctionsList: SanctionsEntry[] = [
  {
    id: 'sanction_001',
    name: 'Blocked Entity Alpha',
    aliases: ['BEA', 'Alpha Group'],
    type: 'entity',
    listSource: 'OFAC-SDN',
    programs: ['CYBER2', 'E.O. 13694'],
    jurisdictions: ['RU'],
    effectiveDate: '2024-01-15',
  },
  {
    id: 'sanction_002',
    name: 'Sanctioned Individual Beta',
    aliases: ['John Doe', 'J. Beta'],
    type: 'individual',
    listSource: 'OFAC-SDN',
    programs: ['NPWMD'],
    jurisdictions: ['KP'],
    effectiveDate: '2024-02-20',
  },
  {
    id: 'sanction_003',
    name: 'High-Risk Organization Gamma',
    aliases: ['HROG', 'Gamma Corp'],
    type: 'entity',
    listSource: 'EU-Consolidated',
    programs: ['TERRORISM'],
    jurisdictions: ['SY'],
    effectiveDate: '2024-03-10',
  },
];

// In-memory watchlist (in production, this would be a proper database)
const watchlist: WatchlistEntry[] = [
  {
    id: 'watch_001',
    name: 'Politically Exposed Person A',
    type: 'pep',
    category: 'Head of State',
    jurisdiction: 'Unknown',
    source: 'World-Check',
    dateAdded: '2024-01-01',
  },
  {
    id: 'watch_002',
    name: 'Adverse Media Subject B',
    type: 'adverse_media',
    category: 'Financial Crime',
    source: 'Media-Monitor',
    dateAdded: '2024-02-15',
  },
];

// Screening audit log (in production, this would be persistent storage)
const screeningAuditLog: KytScreeningResult[] = [];

/**
 * Validate KYT screening request
 */
export function validateKytScreeningRequest(body: unknown): body is KytScreeningRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as KytScreeningRequest;

  // Validate transaction exists
  if (!req.transaction || typeof req.transaction !== 'object') {
    return false;
  }

  const tx = req.transaction;

  // Validate amount
  if (typeof tx.amount !== 'number' || tx.amount <= 0) {
    return false;
  }

  // Validate currency
  if (typeof tx.currency !== 'string' || tx.currency.trim() === '') {
    return false;
  }

  // Validate sender
  if (!tx.sender || typeof tx.sender !== 'object') {
    return false;
  }
  if (typeof tx.sender.id !== 'string' || tx.sender.id.trim() === '') {
    return false;
  }
  if (!['agent', 'wallet', 'address', 'individual', 'business'].includes(tx.sender.type)) {
    return false;
  }

  // Validate recipient
  if (!tx.recipient || typeof tx.recipient !== 'object') {
    return false;
  }
  if (typeof tx.recipient.id !== 'string' || tx.recipient.id.trim() === '') {
    return false;
  }
  if (!['agent', 'wallet', 'address', 'individual', 'business'].includes(tx.recipient.type)) {
    return false;
  }

  return true;
}

/**
 * Check sanctions lists
 */
function checkSanctions(
  party: KytTransactionDetails['sender'] | KytTransactionDetails['recipient']
): SanctionsCheckResult[] {
  const results: SanctionsCheckResult[] = [];

  for (const entry of sanctionsList) {
    const namesToCheck = [entry.name, ...entry.aliases];
    let matchFound = false;
    let matchDetails = undefined;

    // Simple name matching (in production, use fuzzy matching)
    for (const name of namesToCheck) {
      if (party.id.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(party.id.toLowerCase())) {
        matchFound = true;
        matchDetails = {
          entityName: entry.name,
          entityType: entry.type,
          matchScore: 0.95,
        };
        break;
      }
    }

    results.push({
      listName: entry.listSource,
      checked: true,
      matchFound,
      matchDetails,
    });
  }

  return results;
}

/**
 * Check watchlists
 */
function checkWatchlists(
  party: KytTransactionDetails['sender'] | KytTransactionDetails['recipient']
): Array<{ listName: string; type: string; matchFound: boolean; matchDetails?: unknown }> {
  const results: Array<{ listName: string; type: string; matchFound: boolean; matchDetails?: unknown }> = [];

  for (const entry of watchlist) {
    let matchFound = false;

    if (party.id.toLowerCase().includes(entry.name.toLowerCase()) ||
        entry.name.toLowerCase().includes(party.id.toLowerCase())) {
      matchFound = true;
    }

    results.push({
      listName: entry.source,
      type: entry.type,
      matchFound,
      matchDetails: matchFound ? { category: entry.category } : undefined,
    });
  }

  return results;
}

/**
 * Check geography risk
 */
function checkGeography(
  party: KytTransactionDetails['sender'] | KytTransactionDetails['recipient'],
  checkType: 'sender' | 'recipient'
): GeographyCheckResult[] {
  const results: GeographyCheckResult[] = [];

  if (!party.jurisdiction) {
    return results;
  }

  const jurisdiction = party.jurisdiction.toUpperCase();
  const flags: string[] = [];

  if (PROHIBITED_JURISDICTIONS.includes(jurisdiction)) {
    flags.push('Prohibited jurisdiction');
    results.push({
      jurisdiction,
      riskLevel: 'prohibited',
      checkType,
      flags,
    });
  } else if (HIGH_RISK_JURISDICTIONS.includes(jurisdiction)) {
    flags.push('High-risk jurisdiction');
    results.push({
      jurisdiction,
      riskLevel: 'high',
      checkType,
      flags,
    });
  }

  return results;
}

/**
 * Calculate risk score based on amount
 */
function calculateAmountRisk(
  amount: number,
  currency: string
): { score: number; checks: AmountCheckResult[] } {
  let score = 0;
  const checks: AmountCheckResult[] = [];

  // High-value transaction threshold (in production, this would be configurable)
  const highValueThreshold = 10000;
  
  // Check single transaction amount
  if (amount >= highValueThreshold) {
    score += 20;
    checks.push({
      checkType: 'single_transaction',
      threshold: highValueThreshold,
      actual: amount,
      exceeded: true,
    });
  }

  // Very high-value transaction
  if (amount >= 100000) {
    score += 30;
  }

  // Check for suspicious amounts (structuring indicators)
  if (amount >= 9990 && amount < 10000) {
    score += 15;
    checks.push({
      checkType: 'velocity',
      threshold: 10000,
      actual: amount,
      exceeded: false,
    });
  }

  return { score, checks };
}

/**
 * Perform KYT screening
 */
export async function performKytScreening(
  request: KytScreeningRequest
): Promise<KytScreeningResult> {
  const screeningId = `kyt_${uuidv4().replace(/-/g, '')}`;
  const flags: KytRiskFlag[] = [];
  let riskScore = 0;

  const options = {
    checkSanctions: true,
    checkWatchlists: true,
    checkGeography: true,
    checkAmount: true,
    ...request.screeningOptions,
  };

  const { transaction } = request;
  const sanctionsChecks: SanctionsCheckResult[] = [];
  const geographyChecks: GeographyCheckResult[] = [];
  const amountChecks: AmountCheckResult[] = [];

  // Check sender against sanctions
  if (options.checkSanctions) {
    const senderSanctions = checkSanctions(transaction.sender);
    sanctionsChecks.push(...senderSanctions);

    for (const check of senderSanctions) {
      if (check.matchFound) {
        flags.push({
          type: 'sanctions',
          severity: 'critical',
          code: 'SANCTIONS_MATCH_SENDER',
          message: `Sender matched on ${check.listName}: ${check.matchDetails?.entityName}`,
          details: check.matchDetails,
        });
        riskScore += 50;
      }
    }

    // Check recipient against sanctions
    const recipientSanctions = checkSanctions(transaction.recipient);
    sanctionsChecks.push(...recipientSanctions);

    for (const check of recipientSanctions) {
      if (check.matchFound) {
        flags.push({
          type: 'sanctions',
          severity: 'critical',
          code: 'SANCTIONS_MATCH_RECIPIENT',
          message: `Recipient matched on ${check.listName}: ${check.matchDetails?.entityName}`,
          details: check.matchDetails,
        });
        riskScore += 50;
      }
    }
  }

  // Check watchlists
  if (options.checkWatchlists) {
    const senderWatchlist = checkWatchlists(transaction.sender);
    for (const check of senderWatchlist) {
      if (check.matchFound) {
        flags.push({
          type: 'watchlist',
          severity: 'high',
          code: 'WATCHLIST_MATCH_SENDER',
          message: `Sender matched on ${check.listName} (${check.type})`,
          details: check.matchDetails as Record<string, unknown> | undefined,
        });
        riskScore += 25;
      }
    }

    const recipientWatchlist = checkWatchlists(transaction.recipient);
    for (const check of recipientWatchlist) {
      if (check.matchFound) {
        flags.push({
          type: 'watchlist',
          severity: 'high',
          code: 'WATCHLIST_MATCH_RECIPIENT',
          message: `Recipient matched on ${check.listName} (${check.type})`,
          details: check.matchDetails as Record<string, unknown> | undefined,
        });
        riskScore += 25;
      }
    }
  }

  // Check geography
  if (options.checkGeography) {
    const senderGeo = checkGeography(transaction.sender, 'sender');
    geographyChecks.push(...senderGeo);

    for (const check of senderGeo) {
      if (check.riskLevel === 'prohibited') {
        flags.push({
          type: 'geography',
          severity: 'critical',
          code: 'PROHIBITED_JURISDICTION_SENDER',
          message: `Sender jurisdiction prohibited: ${check.jurisdiction}`,
          details: { jurisdiction: check.jurisdiction },
        });
        riskScore += 50;
      } else if (check.riskLevel === 'high') {
        flags.push({
          type: 'geography',
          severity: 'high',
          code: 'HIGH_RISK_JURISDICTION_SENDER',
          message: `Sender jurisdiction high-risk: ${check.jurisdiction}`,
          details: { jurisdiction: check.jurisdiction },
        });
        riskScore += 20;
      }
    }

    const recipientGeo = checkGeography(transaction.recipient, 'recipient');
    geographyChecks.push(...recipientGeo);

    for (const check of recipientGeo) {
      if (check.riskLevel === 'prohibited') {
        flags.push({
          type: 'geography',
          severity: 'critical',
          code: 'PROHIBITED_JURISDICTION_RECIPIENT',
          message: `Recipient jurisdiction prohibited: ${check.jurisdiction}`,
          details: { jurisdiction: check.jurisdiction },
        });
        riskScore += 50;
      } else if (check.riskLevel === 'high') {
        flags.push({
          type: 'geography',
          severity: 'high',
          code: 'HIGH_RISK_JURISDICTION_RECIPIENT',
          message: `Recipient jurisdiction high-risk: ${check.jurisdiction}`,
          details: { jurisdiction: check.jurisdiction },
        });
        riskScore += 20;
      }
    }
  }

  // Check amount
  if (options.checkAmount) {
    const amountRisk = calculateAmountRisk(transaction.amount, transaction.currency);
    amountChecks.push(...amountRisk.checks);
    riskScore += amountRisk.score;

    if (amountRisk.score > 0) {
      flags.push({
        type: 'amount',
        severity: amountRisk.score >= 30 ? 'high' : 'medium',
        code: 'AMOUNT_RISK',
        message: `Transaction amount risk detected: ${transaction.amount} ${transaction.currency}`,
        details: { amount: transaction.amount, currency: transaction.currency },
      });
    }
  }

  // Determine risk level and status
  let riskLevel: KytRiskLevel = 'low';
  if (riskScore >= 70) {
    riskLevel = 'critical';
  } else if (riskScore >= 40) {
    riskLevel = 'high';
  } else if (riskScore >= 15) {
    riskLevel = 'medium';
  }

  const status: KytScreeningStatus = riskLevel === 'critical' ? 'blocked' : 
                                     riskLevel === 'high' ? 'flagged' : 'passed';

  const result: KytScreeningResult = {
    screeningId,
    status,
    riskScore,
    riskLevel,
    flags,
    sanctionsChecks: options.checkSanctions ? sanctionsChecks : undefined,
    geographyChecks: options.checkGeography ? geographyChecks : undefined,
    amountChecks: options.checkAmount ? amountChecks : undefined,
    screenedAt: new Date().toISOString(),
  };

  // Log screening for audit
  screeningAuditLog.push(result);

  return result;
}

/**
 * Transform screening result to API response format
 */
export function transformToResponse(result: KytScreeningResult): KytScreeningResponse {
  const criticalFlags = result.flags.filter(f => f.severity === 'critical').length;

  return {
    screeningId: result.screeningId,
    status: result.status,
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    flags: result.flags,
    summary: {
      sanctionsChecked: result.sanctionsChecks !== undefined,
      watchlistsChecked: true,
      geographyChecked: result.geographyChecks !== undefined,
      amountChecked: result.amountChecks !== undefined,
      totalFlags: result.flags.length,
      criticalFlags,
    },
    screenedAt: result.screenedAt,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };
}

/**
 * Get screening by ID (for audit trail)
 */
export function getScreeningById(screeningId: string): KytScreeningResult | undefined {
  return screeningAuditLog.find(s => s.screeningId === screeningId);
}

/**
 * Get screening audit log (for compliance reporting)
 */
export function getScreeningAuditLog(
  startDate?: string,
  endDate?: string
): KytScreeningResult[] {
  let logs = [...screeningAuditLog];

  if (startDate) {
    const start = new Date(startDate);
    logs = logs.filter(s => new Date(s.screenedAt) >= start);
  }

  if (endDate) {
    const end = new Date(endDate);
    logs = logs.filter(s => new Date(s.screenedAt) <= end);
  }

  return logs;
}

// Travel Rule storage (in production, this would be persistent storage)
const travelRuleRecords: TravelRuleResult[] = [];

/**
 * Validate IVMS 101 Travel Rule request
 * Checks required fields per FATF guidelines
 */
export function validateTravelRuleRequest(body: unknown): body is TravelRuleRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as TravelRuleRequest;

  // Validate transaction exists
  if (!req.transaction || typeof req.transaction !== 'object') {
    return false;
  }

  const tx = req.transaction;

  // Validate required transaction fields
  if (typeof tx.txId !== 'string' || tx.txId.trim() === '') {
    return false;
  }

  if (typeof tx.transactionType !== 'string' || tx.transactionType.trim() === '') {
    return false;
  }

  if (typeof tx.dateTime !== 'string' || tx.dateTime.trim() === '') {
    return false;
  }

  if (typeof tx.amount !== 'number' || tx.amount <= 0) {
    return false;
  }

  if (typeof tx.currency !== 'string' || tx.currency.trim() === '') {
    return false;
  }

  // Validate originator (required per FATF Travel Rule)
  if (!validateIvmsOriginator(tx.originator)) {
    return false;
  }

  // Validate beneficiary (required per FATF Travel Rule)
  if (!validateIvmsBeneficiary(tx.beneficiary)) {
    return false;
  }

  // Validate originating VASP
  if (!tx.originatingVasp || !tx.originatingVasp.legalPerson) {
    return false;
  }

  // Validate beneficiary VASP
  if (!tx.beneficiaryVasp || !tx.beneficiaryVasp.legalPerson) {
    return false;
  }

  return true;
}

/**
 * Validate IVMS 101 Originator data
 * Per FATF: originator name and account number are required
 */
function validateIvmsOriginator(originator: IvmsOriginator | undefined): boolean {
  if (!originator || !Array.isArray(originator.originatorPersons) || originator.originatorPersons.length === 0) {
    return false;
  }

  // At least one person must have a valid name
  for (const person of originator.originatorPersons) {
    if (validateIvmsPerson(person)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate IVMS 101 Beneficiary data
 * Per FATF: beneficiary name and account number are required
 */
function validateIvmsBeneficiary(beneficiary: IvmsBeneficiary | undefined): boolean {
  if (!beneficiary || !Array.isArray(beneficiary.beneficiaryPersons) || beneficiary.beneficiaryPersons.length === 0) {
    return false;
  }

  // At least one person must have a valid name
  for (const person of beneficiary.beneficiaryPersons) {
    if (validateIvmsPerson(person)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate IVMS 101 Person data
 */
function validateIvmsPerson(person: IvmsPerson | undefined): boolean {
  if (!person) {
    return false;
  }

  // Natural person validation
  if (person.naturalPerson) {
    const np = person.naturalPerson;
    if (!Array.isArray(np.name) || np.name.length === 0) {
      return false;
    }
    // At least one name identifier required
    for (const name of np.name) {
      if (Array.isArray(name.nameIdentifier) && name.nameIdentifier.length > 0) {
        for (const ni of name.nameIdentifier) {
          if (typeof ni.primaryIdentifier === 'string' && ni.primaryIdentifier.trim() !== '') {
            return true;
          }
        }
      }
    }
  }

  // Legal person validation
  if (person.legalPerson) {
    const lp = person.legalPerson;
    if (!Array.isArray(lp.name) || lp.name.length === 0) {
      return false;
    }
    for (const name of lp.name) {
      if (Array.isArray(name.nameIdentifier) && name.nameIdentifier.length > 0) {
        for (const ni of name.nameIdentifier) {
          if (typeof ni.primaryIdentifier === 'string' && ni.primaryIdentifier.trim() !== '') {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Simulate VASP data exchange
 * In production, this would make HTTP requests to counterparty VASP APIs
 */
async function exchangeWithCounterpartyVasp(
  transaction: IvmsTransaction
): Promise<{ success: boolean; status: 'accepted' | 'rejected'; reason?: string; vaspDid: string }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Generate a deterministic VASP DID based on beneficiary VASP name
  const vaspName = transaction.beneficiaryVasp.legalPerson.name[0]?.nameIdentifier[0]?.primaryIdentifier || 'unknown';
  const vaspDid = `did:vasp:${Buffer.from(vaspName).toString('base64url').substring(0, 16)}`;

  // Simulate validation logic
  // Reject if amount exceeds simulated threshold for demo purposes
  if (transaction.amount > 1000000) {
    return {
      success: false,
      status: 'rejected',
      reason: 'Amount exceeds VASP risk threshold',
      vaspDid,
    };
  }

  // Check if originating VASP is from a prohibited jurisdiction
  const originatingCountry = transaction.originatingVasp.legalPerson.geographicAddress?.country;
  if (originatingCountry && PROHIBITED_JURISDICTIONS.includes(originatingCountry.toUpperCase())) {
    return {
      success: false,
      status: 'rejected',
      reason: 'Originating VASP jurisdiction not supported',
      vaspDid,
    };
  }

  return {
    success: true,
    status: 'accepted',
    vaspDid,
  };
}

/**
 * Process Travel Rule compliance check
 */
export async function processTravelRule(
  request: TravelRuleRequest
): Promise<TravelRuleResult> {
  const travelRuleId = `tr_${uuidv4().replace(/-/g, '')}`;
  const flags: TravelRuleFlag[] = [];
  const transactionHash = request.transaction.transactionHash || request.transaction.txId;

  // Validate originator data completeness
  let originatorValidated = true;
  const originator = request.transaction.originator;

  // Check for required originator fields per FATF
  const hasOriginatorName = originator.originatorPersons.some(p =>
    p.naturalPerson?.name?.some(n =>
      n.nameIdentifier?.some(ni => ni.primaryIdentifier)
    ) ||
    p.legalPerson?.name?.some(n =>
      n.nameIdentifier?.some(ni => ni.primaryIdentifier)
    )
  );

  if (!hasOriginatorName) {
    originatorValidated = false;
    flags.push({
      type: 'validation',
      severity: 'critical',
      code: 'ORIGINATOR_NAME_MISSING',
      message: 'Originator name is required per FATF Travel Rule',
    });
  }

  // Check for originator account number
  const hasOriginatorAccount = originator.accountNumber && originator.accountNumber.length > 0;
  if (!hasOriginatorAccount) {
    flags.push({
      type: 'validation',
      severity: 'medium',
      code: 'ORIGINATOR_ACCOUNT_MISSING',
      message: 'Originator account number is recommended per FATF guidelines',
    });
  }

  // Validate beneficiary data completeness
  let beneficiaryValidated = true;
  const beneficiary = request.transaction.beneficiary;

  const hasBeneficiaryName = beneficiary.beneficiaryPersons.some(p =>
    p.naturalPerson?.name?.some(n =>
      n.nameIdentifier?.some(ni => ni.primaryIdentifier)
    ) ||
    p.legalPerson?.name?.some(n =>
      n.nameIdentifier?.some(ni => ni.primaryIdentifier)
    )
  );

  if (!hasBeneficiaryName) {
    beneficiaryValidated = false;
    flags.push({
      type: 'validation',
      severity: 'critical',
      code: 'BENEFICIARY_NAME_MISSING',
      message: 'Beneficiary name is required per FATF Travel Rule',
    });
  }

  // Check for beneficiary account number
  const hasBeneficiaryAccount = beneficiary.accountNumber && beneficiary.accountNumber.length > 0;
  if (!hasBeneficiaryAccount) {
    flags.push({
      type: 'validation',
      severity: 'medium',
      code: 'BENEFICIARY_ACCOUNT_MISSING',
      message: 'Beneficiary account number is recommended per FATF guidelines',
    });
  }

  // Perform VASP exchange
  let vaspExchangeStatus: 'pending' | 'completed' | 'failed' = 'pending';
  let counterpartyResponse: TravelRuleResult['counterpartyResponse'] | undefined;

  try {
    const exchangeResult = await exchangeWithCounterpartyVasp(request.transaction);
    vaspExchangeStatus = exchangeResult.success ? 'completed' : 'failed';

    counterpartyResponse = {
      vaspDid: exchangeResult.vaspDid,
      status: exchangeResult.status,
      reason: exchangeResult.reason,
      timestamp: new Date().toISOString(),
    };

    if (!exchangeResult.success) {
      flags.push({
        type: 'vasp_exchange',
        severity: 'high',
        code: 'COUNTERPARTY_REJECTED',
        message: `Counterparty VASP rejected the travel rule: ${exchangeResult.reason}`,
        details: { vaspDid: exchangeResult.vaspDid, reason: exchangeResult.reason },
      });
    }
  } catch (error) {
    vaspExchangeStatus = 'failed';
    flags.push({
      type: 'vasp_exchange',
      severity: 'high',
      code: 'VASP_EXCHANGE_FAILED',
      message: 'Failed to exchange data with counterparty VASP',
      details: { error: String(error) },
    });
  }

  // Determine overall status
  let status: TravelRuleStatus = 'pending';
  if (!originatorValidated || !beneficiaryValidated) {
    status = 'rejected';
  } else if (vaspExchangeStatus === 'failed') {
    status = 'error';
  } else if (vaspExchangeStatus === 'completed' && counterpartyResponse?.status === 'accepted') {
    status = 'accepted';
  } else if (counterpartyResponse?.status === 'rejected') {
    status = 'rejected';
  }

  const result: TravelRuleResult = {
    travelRuleId,
    status,
    transactionHash,
    originatorValidated,
    beneficiaryValidated,
    vaspExchangeStatus,
    complianceFlags: flags,
    recordedAt: new Date().toISOString(),
    counterpartyResponse,
  };

  // Store travel rule record
  travelRuleRecords.push(result);

  return result;
}

/**
 * Transform travel rule result to API response format
 */
export function transformTravelRuleToResponse(result: TravelRuleResult): TravelRuleResponse {
  return {
    travelRuleId: result.travelRuleId,
    status: result.status,
    transactionHash: result.transactionHash,
    compliance: {
      originatorValidated: result.originatorValidated,
      beneficiaryValidated: result.beneficiaryValidated,
      vaspExchangeComplete: result.vaspExchangeStatus === 'completed',
      flags: result.complianceFlags,
    },
    confirmation: {
      recordedAt: result.recordedAt,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    },
  };
}

/**
 * Get travel rule record by ID
 */
export function getTravelRuleById(travelRuleId: string): TravelRuleResult | undefined {
  return travelRuleRecords.find(r => r.travelRuleId === travelRuleId);
}

/**
 * Get all travel rule records (for audit purposes)
 */
export function getTravelRuleRecords(
  status?: TravelRuleStatus,
  startDate?: string,
  endDate?: string
): TravelRuleResult[] {
  let records = [...travelRuleRecords];

  if (status) {
    records = records.filter(r => r.status === status);
  }

  if (startDate) {
    const start = new Date(startDate);
    records = records.filter(r => new Date(r.recordedAt) >= start);
  }

  if (endDate) {
    const end = new Date(endDate);
    records = records.filter(r => new Date(r.recordedAt) <= end);
  }

  return records;
}
