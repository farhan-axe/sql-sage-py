
/**
 * Format a SQL query to include fully qualified table names with database prefix
 */
export function formatQueryWithDatabasePrefix(query: string, dbName: string): string {
  if (!query || !dbName) return query;
  
  // Regex to find table names in FROM and JOIN clauses that don't already have database prefix
  const tableRegex = /\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)/gi;
  
  return query.replace(tableRegex, (match, clause, tableName) => {
    const cleanTableName = tableName.replace(/\[|\]/g, '');
    return `${clause} [${dbName}].[dbo].[${cleanTableName}]`;
  });
}
