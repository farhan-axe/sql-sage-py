
/**
 * Generates example SQL queries based on the database schema
 * @param tables Array of table information objects
 * @returns String containing example SQL queries
 */
function generateQueryExamples(tables: any[]): string {
  if (tables.length === 0) return '';
  
  let examples = '### SQL Query Examples:\n\n';
  
  // Map of table names to their columns
  const tableColumns: { [tableName: string]: string[] } = {};
  
  // Collect table information
  tables.forEach(table => {
    if (table.name) {
      const columns: string[] = [];
      if (table.columnDetails && table.columnDetails.length > 0) {
        table.columnDetails.forEach((column: any) => {
          columns.push(column.name);
        });
      } else if (table.schema && table.schema.length > 0) {
        table.schema.forEach((column: string) => {
          if (typeof column === 'string') {
            // Extract just the column name if it's in a format like "column_name type"
            const parts = column.split(' ');
            columns.push(parts[0]);
          }
        });
      }
      tableColumns[table.name] = columns;
    }
  });
  
  // Generate examples for each table
  Object.keys(tableColumns).forEach((tableName, index) => {
    if (index > 0) examples += '\n\n';
    
    const columns = tableColumns[tableName];
    
    // Example 1: Count all records
    examples += `1. Count all records in ${tableName}:\n\n`;
    examples += '```sql\n';
    examples += `SELECT COUNT(*) AS TotalRecords\nFROM ${tableName};\n`;
    examples += '```\n\n';
    
    if (columns.length > 0) {
      // Example 2: Select all columns with TOP instead of LIMIT
      examples += `2. Select all columns from ${tableName} (limited to 10 rows):\n\n`;
      examples += '```sql\n';
      examples += `SELECT TOP 10 *\nFROM ${tableName};\n`;
      examples += '```\n\n';
      
      // Example 3: Group by a column if there are enough columns
      if (columns.length >= 2) {
        // Look for MaritalStatus first, then fall back to other categorical columns
        const groupByColumn = columns.find(col => 
          col.toLowerCase() === 'maritalstatus'
        ) || columns.find(col => 
          col.toLowerCase().includes('status') || 
          col.toLowerCase().includes('gender') || 
          col.toLowerCase().includes('type') ||
          col.toLowerCase().includes('city') ||
          col.toLowerCase().includes('province')
        ) || columns[1];
        
        examples += `3. THIS TABLE COUNT RECORDS BY ${groupByColumn.toUpperCase()} WITH GROUPBY:\n\n`;
        examples += '```sql\n';
        examples += `SELECT ${groupByColumn}, COUNT(*) AS Count\n`;
        examples += `FROM ${tableName}\n`;
        examples += `GROUP BY ${groupByColumn}\n`;
        examples += `ORDER BY Count DESC;\n`;
        examples += '```\n';
      }
    }
  });
  
  // Add a cross-table query example if we have multiple tables
  const tableNames = Object.keys(tableColumns);
  if (tableNames.length >= 2) {
    examples += '\n\n### Cross-table queries:\n\n';
    examples += `1. Join ${tableNames[0]} with ${tableNames[1]} on a common column:\n\n`;
    examples += '```sql\n';
    
    // Find a common column between the tables
    const commonColumns = tableColumns[tableNames[0]].filter(col => 
      tableColumns[tableNames[1]].includes(col)
    );
    
    if (commonColumns.length > 0) {
      const joinColumn = commonColumns[0];
      examples += `SELECT TOP 10 a.*, b.*\n`;
      examples += `FROM ${tableNames[0]} AS a\n`;
      examples += `JOIN ${tableNames[1]} AS b ON a.${joinColumn} = b.${joinColumn};\n`;
    } else {
      // If no common columns found, suggest using an artificial example
      examples += `-- Note: No common columns found, but you could join if there were one\n`;
      examples += `SELECT TOP 10 a.*, b.*\n`;
      examples += `FROM ${tableNames[0]} AS a\n`;
      examples += `JOIN ${tableNames[1]} AS b ON a.CommonColumn = b.CommonColumn;\n`;
    }
    
    examples += '```\n';
  }
  
  return examples;
}
