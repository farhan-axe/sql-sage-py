
export const formatQueryWithDatabasePrefix = (query: string, databaseName?: string): string => {
  if (!databaseName) {
    return query;
  }

  const tableRegex = /\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)/gi;
  
  return query.replace(tableRegex, (match, clause, tableName) => {
    const cleanTableName = tableName.replace(/\[|\]/g, '');
    return `${clause} [${databaseName}].[dbo].[${cleanTableName}]`;
  });
};
