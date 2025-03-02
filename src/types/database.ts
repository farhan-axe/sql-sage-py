
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
