
export interface TableInfo {
  name: string;
  schema: string[];
  primaryKey: string;
  example: string;
}

export interface ConnectionConfig {
  server: string;
  database: string;
  useWindowsAuth: boolean;
  username?: string;
  password?: string;
}

export interface DatabaseInfo {
  tables: TableInfo[];
  promptTemplate: string;
  queryExamples: string;
  connectionConfig: ConnectionConfig;
}

export interface QueryRefinementAttempt {
  attempt: number;
  query: string;
  error?: string;
  response?: string; // Added to store raw response
}

// Error types for handling non-SQL responses
export enum QueryErrorType {
  NON_SQL_RESPONSE = "NON_SQL_RESPONSE",
  EXECUTION_ERROR = "EXECUTION_ERROR",
  CONNECTION_ERROR = "CONNECTION_ERROR"
}

export interface QueryError {
  type: QueryErrorType;
  message: string;
  rawResponse?: string;
}

// New interface for SQL query verification results
export interface QueryVerificationResult {
  isValid: boolean;
  reason?: string;
  correctedQuery?: string;
}

// Interface for query generation request payload 
export interface QueryGenerationPayload {
  question: string;
  databaseInfo: DatabaseInfo;
  maxRows: number;
  promptTemplate: string;
  queryExamples: string;
}

// Backend LLM request interface
export interface LLMQueryGenerationRequest {
  question: string;
  databaseSchema: string;
  maxRows: number;
  promptTemplate?: string;
  queryExamples?: string;
}

// API response interfaces
export interface QueryExecutionResponse {
  results: any[];
  refinement_history?: QueryRefinementAttempt[];
}

export interface QueryGenerationResponse {
  query: string;
}

// Updated QueryInterfaceProps interface to include the onQueryGenerated callback
export interface QueryInterfaceProps {
  isConnected: boolean;
  databaseInfo: DatabaseInfo | null;
  onSessionTerminate: (success: boolean) => void;
  onSaveQuery?: (question: string, query: string) => void;
  onQueryGenerated?: (timeInMs: number) => void;
}
