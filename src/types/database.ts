
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
