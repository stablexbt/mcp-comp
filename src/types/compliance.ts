// KYT Screening types for compliance endpoints

export type KytRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type KytScreeningStatus = 'passed' | 'flagged' | 'blocked';

export interface KytTransactionDetails {
  amount: number;
  currency: string;
  sender: {
    id: string;
    type: 'agent' | 'wallet' | 'address' | 'individual' | 'business';
    address?: string;
    jurisdiction?: string;
  };
  recipient: {
    id: string;
    type: 'agent' | 'wallet' | 'address' | 'individual' | 'business';
    address?: string;
    jurisdiction?: string;
  };
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface KytScreeningRequest {
  transaction: KytTransactionDetails;
  screeningOptions?: {
    checkSanctions?: boolean;
    checkWatchlists?: boolean;
    checkGeography?: boolean;
    checkAmount?: boolean;
    customRules?: string[];
  };
}

export interface KytScreeningResult {
  screeningId: string;
  status: KytScreeningStatus;
  riskScore: number;
  riskLevel: KytRiskLevel;
  flags: KytRiskFlag[];
  sanctionsChecks?: SanctionsCheckResult[];
  geographyChecks?: GeographyCheckResult[];
  amountChecks?: AmountCheckResult[];
  screenedAt: string;
}

export interface KytRiskFlag {
  type: 'sanctions' | 'watchlist' | 'geography' | 'amount' | 'velocity' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SanctionsCheckResult {
  listName: string;
  checked: boolean;
  matchFound: boolean;
  matchDetails?: {
    entityName: string;
    entityType: string;
    matchScore: number;
  };
}

export interface GeographyCheckResult {
  jurisdiction: string;
  riskLevel: 'low' | 'medium' | 'high' | 'prohibited';
  checkType: 'sender' | 'recipient' | 'intermediary';
  flags?: string[];
}

export interface AmountCheckResult {
  checkType: 'single_transaction' | 'daily_volume' | 'velocity';
  threshold: number;
  actual: number;
  exceeded: boolean;
}

export interface KytScreeningResponse {
  screeningId: string;
  status: KytScreeningStatus;
  riskScore: number;
  riskLevel: KytRiskLevel;
  flags: KytRiskFlag[];
  summary: {
    sanctionsChecked: boolean;
    watchlistsChecked: boolean;
    geographyChecked: boolean;
    amountChecked: boolean;
    totalFlags: number;
    criticalFlags: number;
  };
  screenedAt: string;
  expiresAt: string;
}

// Sanctions list entry
export interface SanctionsEntry {
  id: string;
  name: string;
  aliases: string[];
  type: 'individual' | 'entity' | 'vessel' | 'aircraft';
  listSource: string;
  programs: string[];
  addresses?: string[];
  jurisdictions?: string[];
  effectiveDate: string;
}

// High-risk jurisdictions
export const HIGH_RISK_JURISDICTIONS = [
  'AF', // Afghanistan
  'BY', // Belarus
  'CF', // Central African Republic
  'CU', // Cuba
  'IR', // Iran
  'KP', // North Korea
  'LY', // Libya
  'MM', // Myanmar
  'RU', // Russia
  'SO', // Somalia
  'SD', // Sudan
  'SY', // Syria
  'VE', // Venezuela
  'YE', // Yemen
  'ZW', // Zimbabwe
];

export const PROHIBITED_JURISDICTIONS = [
  'KP', // North Korea
  'IR', // Iran
  'SY', // Syria
];

// Watchlist entry
export interface WatchlistEntry {
  id: string;
  name: string;
  type: 'pep' | 'adverse_media' | 'enforcement';
  category: string;
  jurisdiction?: string;
  source: string;
  dateAdded: string;
}

// IVMS 101 Travel Rule Types
// Based on FATF Travel Rule guidelines for cross-border crypto transfers

export interface IvmsOriginator {
  originatorPersons: IvmsPerson[];
  accountNumber?: string[];
}

export interface IvmsBeneficiary {
  beneficiaryPersons: IvmsPerson[];
  accountNumber?: string[];
}

export interface IvmsPerson {
  naturalPerson?: IvmsNaturalPerson;
  legalPerson?: IvmsLegalPerson;
}

export interface IvmsNaturalPerson {
  name: IvmsName[];
  geographicAddress?: IvmsGeographicAddress;
  nationalIdentification?: IvmsNationalIdentification;
  dateAndPlaceOfBirth?: IvmsDateAndPlaceOfBirth;
}

export interface IvmsLegalPerson {
  name: IvmsName[];
  geographicAddress?: IvmsGeographicAddress;
  nationalIdentification?: IvmsNationalIdentification;
}

export interface IvmsName {
  nameIdentifier: IvmsNameIdentifier[];
}

export interface IvmsNameIdentifier {
  primaryIdentifier: string;
  secondaryIdentifier?: string;
  nameIdentifierType: 'LEGAL_NAME' | 'ALIAS_NAME' | 'BIRTH_NAME' | 'MAIDEN_NAME';
}

export interface IvmsGeographicAddress {
  addressType?: 'HOME' | 'WORK' | 'GEOG';
  department?: string;
  subDepartment?: string;
  streetName?: string;
  buildingNumber?: string;
  buildingName?: string;
  floor?: string;
  postBox?: string;
  room?: string;
  postCode?: string;
  townName: string;
  countrySubDivision?: string;
  country: string;
  addressLine?: string[];
}

export interface IvmsNationalIdentification {
  nationalIdentifier: string;
  nationalIdentifierType: 'ARNU' | 'CCPT' | 'RAID' | 'DRLC' | 'FIIN' | 'TXID';
  countryOfIssue?: string;
  registrationAuthority?: string;
}

export interface IvmsDateAndPlaceOfBirth {
  dateOfBirth: string; // ISO 8601 format
  placeOfBirth: string;
}

export interface IvmsOriginatingVasp {
  legalPerson: IvmsLegalPerson;
}

export interface IvmsBeneficiaryVasp {
  legalPerson: IvmsLegalPerson;
}

export interface IvmsTransaction {
  txId: string;
  transactionHash?: string;
  transactionType: string;
  dateTime: string;
  amount: number;
  currency: string;
  originator: IvmsOriginator;
  beneficiary: IvmsBeneficiary;
  originatingVasp: IvmsOriginatingVasp;
  beneficiaryVasp: IvmsBeneficiaryVasp;
}

export interface TravelRuleRequest {
  transaction: IvmsTransaction;
  callbackUrl?: string;
}

export type TravelRuleStatus = 'pending' | 'accepted' | 'rejected' | 'error';

export interface TravelRuleResult {
  travelRuleId: string;
  status: TravelRuleStatus;
  transactionHash: string;
  originatorValidated: boolean;
  beneficiaryValidated: boolean;
  vaspExchangeStatus: 'pending' | 'completed' | 'failed';
  complianceFlags: TravelRuleFlag[];
  recordedAt: string;
  counterpartyResponse?: {
    vaspDid: string;
    status: 'accepted' | 'rejected';
    reason?: string;
    timestamp: string;
  };
}

export interface TravelRuleFlag {
  type: 'validation' | 'vasp_exchange' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface TravelRuleResponse {
  travelRuleId: string;
  status: TravelRuleStatus;
  transactionHash: string;
  compliance: {
    originatorValidated: boolean;
    beneficiaryValidated: boolean;
    vaspExchangeComplete: boolean;
    flags: TravelRuleFlag[];
  };
  confirmation: {
    recordedAt: string;
    expiresAt: string;
  };
}
