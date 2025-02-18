
export interface TableInfo {
  name: string;
  schema: string[];
  primaryKey: string;
  example: string;
}

export interface DatabaseInfo {
  tables: TableInfo[];
  promptTemplate: string;
}
