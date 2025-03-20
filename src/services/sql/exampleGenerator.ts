
/**
 * Functions for generating SQL query examples
 */

/**
 * Generates example SQL queries based on the database schema
 * @param tables Array of table information objects
 * @param dbName Database name
 * @returns String containing example SQL queries
 */
export function generateQueryExamples(tables: any[], dbName: string = ""): string {
  if (!tables || tables.length === 0) {
    return 'No tables available to generate examples. Please make sure the database contains tables and you have permission to access them.';
  }
  
  // Start building examples
  let examples = 'Below are some general examples of questions:\n\n';
  
  // Sort tables by name for consistency
  const sortedTables = [...tables].sort((a, b) => {
    if (a.name && b.name) {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  // First, generate count examples for each table
  sortedTables.forEach((table, index) => {
    if (table.name) {
      // Use tableSchema consistently
      const schemaName = table.tableSchema || 'dbo';
      const fullTableName = table.fullName || `[${dbName}].[${schemaName}].[${table.name}]`;
      const displayName = table.displayName || table.name;
      
      // Add count example for each table with proper table name
      examples += `${index + 1}. Calculate the total number of records in ${displayName}?,\n`;
      examples += `Your SQL Query will be like "SELECT COUNT(*) AS TotalRecords FROM ${fullTableName};"\n\n`;
    }
  });
  
  // After generating count examples for all tables, add a few more complex examples
  const tableCount = sortedTables.length;
  let exampleIndex = tableCount + 1;
  
  // Find a few representative tables to use for more complex examples
  const exampleTables = sortedTables.slice(0, Math.min(4, sortedTables.length));
  
  if (exampleTables.length >= 1) {
    const table = exampleTables[0];
    // Use tableSchema consistently
    const schemaName = table.tableSchema || 'dbo';
    const fullTableName = table.fullName || `[${dbName}].[${schemaName}].[${table.name}]`;
    const displayName = table.displayName || table.name;
    
    examples += `${exampleIndex}. Show me the top 10 records from ${displayName}?,\n`;
    examples += `Your SQL Query will be like "SELECT TOP 10 * FROM ${fullTableName};"\n\n`;
    exampleIndex++;
  }
  
  if (exampleTables.length >= 2) {
    const table1 = exampleTables[0];
    const table2 = exampleTables[1];
    
    // Use tableSchema consistently for both tables
    const schema1 = table1.tableSchema || 'dbo';
    const schema2 = table2.tableSchema || 'dbo';
    
    const fullTableName1 = table1.fullName || `[${dbName}].[${schema1}].[${table1.name}]`;
    const fullTableName2 = table2.fullName || `[${dbName}].[${schema2}].[${table2.name}]`;
    
    const displayName1 = table1.displayName || table1.name;
    const displayName2 = table2.displayName || table2.name;
    
    // Find potential join columns (looking for similar column names that might be keys)
    let joinColumn1 = "ID";
    let joinColumn2 = "ID";
    
    // Helper function to get column names from a table
    const getColumnNames = (table: any): string[] => {
      if (table.columns && Array.isArray(table.columns)) {
        return table.columns.map((col: any) => {
          return typeof col === 'string' ? col : (col.name || "");
        });
      }
      return [];
    };
    
    const table1Columns = getColumnNames(table1);
    const table2Columns = getColumnNames(table2);
    
    // First look for primary keys
    const findPrimaryKeyColumn = (table: any): string | null => {
      if (table.columns && Array.isArray(table.columns)) {
        for (const col of table.columns) {
          if (typeof col !== 'string' && col.isPrimaryKey) {
            return col.name;
          }
        }
      }
      return null;
    };
    
    const pk1 = findPrimaryKeyColumn(table1);
    const pk2 = findPrimaryKeyColumn(table2);
    
    if (pk1) joinColumn1 = pk1;
    if (pk2) joinColumn2 = pk2;
    
    // If no primary keys, look for matching columns or columns with KEY or ID in the name
    if (!pk1 || !pk2) {
      // Look for exact column name matches
      for (const col1 of table1Columns) {
        for (const col2 of table2Columns) {
          if (col1.toLowerCase() === col2.toLowerCase()) {
            joinColumn1 = col1;
            joinColumn2 = col2;
            break;
          }
        }
      }
      
      // If still no match, look for ID/KEY columns
      if (joinColumn1 === "ID" || joinColumn2 === "ID") {
        for (const col1 of table1Columns) {
          if (col1.toLowerCase().includes('id') || col1.toLowerCase().includes('key')) {
            joinColumn1 = col1;
            break;
          }
        }
        
        for (const col2 of table2Columns) {
          if (col2.toLowerCase().includes('id') || col2.toLowerCase().includes('key')) {
            joinColumn2 = col2;
            break;
          }
        }
      }
    }
    
    examples += `${exampleIndex}. Join ${displayName1} with ${displayName2}?,\n`;
    examples += `Your SQL Query will be like "SELECT t1.*, t2.*\nFROM ${fullTableName1} t1\nJOIN ${fullTableName2} t2 ON t1.${joinColumn1} = t2.${joinColumn2};"\n\n`;
    exampleIndex++;
  }
  
  if (exampleTables.length >= 1) {
    const table = exampleTables[0];
    // Use tableSchema consistently
    const schemaName = table.tableSchema || 'dbo';
    const fullTableName = table.fullName || `[${dbName}].[${schemaName}].[${table.name}]`;
    const displayName = table.displayName || table.name;
    
    // Try to find a suitable column for GROUP BY
    let groupByColumn = "";
    
    // Helper function to get column information
    const getColumnsInfo = (table: any): any[] => {
      if (table.columns && Array.isArray(table.columns)) {
        return table.columns.map((col: any) => {
          if (typeof col === 'string') {
            return { name: col, type: 'unknown' };
          }
          return col;
        });
      }
      return [];
    };
    
    const columnsInfo = getColumnsInfo(table);
    
    // Look for a categorical column (avoiding ID columns)
    for (const col of columnsInfo) {
      const colName = col.name || "";
      const colType = (col.type || "").toLowerCase();
      
      if (!colName.toLowerCase().includes('id') && 
          !colName.toLowerCase().includes('key') && 
          !colName.toLowerCase().includes('date') &&
          (colType.includes('char') || colType.includes('varchar') || colType === 'nvarchar')) {
        groupByColumn = colName;
        break;
      }
    }
    
    // If no good categorical column was found, just use the first column
    if (!groupByColumn && columnsInfo.length > 0) {
      groupByColumn = columnsInfo[0].name || "";
    }
    
    if (groupByColumn) {
      examples += `${exampleIndex}. Count records in ${displayName} grouped by ${groupByColumn}?,\n`;
      examples += `Your SQL Query will be like "SELECT ${groupByColumn}, COUNT(*) AS Count\nFROM ${fullTableName}\nGROUP BY ${groupByColumn}\nORDER BY Count DESC;"\n\n`;
      exampleIndex++;
    }
  }
  
  // Add a filter example
  if (exampleTables.length >= 1) {
    const table = exampleTables[0];
    // Use tableSchema consistently
    const schemaName = table.tableSchema || 'dbo';
    const fullTableName = table.fullName || `[${dbName}].[${schemaName}].[${table.name}]`;
    const displayName = table.displayName || table.name;
    
    // Try to find a suitable column for filtering
    let filterColumn = "";
    
    // Helper function to get column information
    const getColumnsInfo = (table: any): any[] => {
      if (table.columns && Array.isArray(table.columns)) {
        return table.columns.map((col: any) => {
          if (typeof col === 'string') {
            return { name: col, type: 'unknown' };
          }
          return col;
        });
      }
      return [];
    };
    
    const columnsInfo = getColumnsInfo(table);
    
    // Look for a numeric column or date column
    for (const col of columnsInfo) {
      const colName = col.name || "";
      const colType = (col.type || "").toLowerCase();
      
      if (colName.toLowerCase().includes('amount') || 
          colName.toLowerCase().includes('price') || 
          colName.toLowerCase().includes('cost') ||
          colName.toLowerCase().includes('quantity') ||
          colType.includes('int') ||
          colType.includes('decimal') ||
          colType.includes('float') ||
          colType.includes('money')) {
        filterColumn = colName;
        break;
      }
    }
    
    // If no numeric column, look for date column
    if (!filterColumn) {
      for (const col of columnsInfo) {
        const colName = col.name || "";
        const colType = (col.type || "").toLowerCase();
        
        if (colName.toLowerCase().includes('date') || 
            colType.includes('date') ||
            colType.includes('time')) {
          filterColumn = colName;
          break;
        }
      }
    }
    
    // If still no column found, just use the first column
    if (!filterColumn && columnsInfo.length > 0) {
      filterColumn = columnsInfo[0].name || "";
    }
    
    if (filterColumn) {
      examples += `${exampleIndex}. Get all records from ${displayName} where ${filterColumn} is greater than a specific value?,\n`;
      examples += `Your SQL Query will be like "SELECT * FROM ${fullTableName} WHERE ${filterColumn} > [value];"\n\n`;
    }
  }
  
  return examples;
}
