
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
  
  // Check if the most common tables from AdventureWorks DW are present
  const hasCustomerTable = tables.some(t => t.name === 'DimCustomer');
  const hasSalesTable = tables.some(t => t.name === 'FactInternetSales');
  const hasProductTable = tables.some(t => t.name === 'DimProduct');
  
  // If this appears to be AdventureWorks DW, use the provided examples
  if (hasCustomerTable && hasSalesTable) {
    let examples = 'Below are some general examples of questions:\n\n';
    
    // First generate count examples for EACH table
    tables.forEach((table, index) => {
      if (table.name) {
        // Add count example for each table with database.dbo prefix
        examples += `${index + 1}. Calculate me the total number of records in ${table.name}?,\n`;
        examples += `Your SQL Query will be like "SELECT COUNT(*) AS TotalRecords FROM [${dbName}].[dbo].[${table.name}];"\n\n`;
      }
    });
    
    // After the count examples, add the standard AdventureWorks examples
    const startIndex = tables.length + 1;
    
    examples += `${startIndex}. Calculate me the total number of customers?,\n`;
    examples += `Your SQL Query will be like "SELECT COUNT(DISTINCT CustomerKey) FROM [${dbName}].[dbo].[DimCustomer];"\n\n`;
    
    examples += `${startIndex + 1}. Calculate me the total number of customers who have purchased more than 5 products?,\n`;
    examples += `Your SQL Query will be like "WITH InternetSalesCTE AS (
    SELECT CustomerKey, ProductKey
    FROM [${dbName}].[dbo].[FactInternetSales]
)
SELECT SUM(TotalProductsPurchased) FROM (
    SELECT CustomerKey, COUNT(DISTINCT ProductKey) AS TotalProductsPurchased
    FROM InternetSalesCTE
    GROUP BY CustomerKey
    HAVING COUNT(DISTINCT ProductKey) > 5
) x;"\n\n`;
    
    examples += `${startIndex + 2}. Provide me the list of customers who have purchased more than 5 products?,\n`;
    examples += `Your SQL Query will be like "WITH InternetSalesCTE AS (
    SELECT CustomerKey, ProductKey
    FROM [${dbName}].[dbo].[FactInternetSales]
),
CustomerPurchases AS (
    SELECT CustomerKey, COUNT(DISTINCT ProductKey) AS TotalProductsPurchased
    FROM InternetSalesCTE
    GROUP BY CustomerKey
    HAVING COUNT(DISTINCT ProductKey) > 5
)
SELECT d.CustomerKey, d.FirstName, d.LastName, cp.TotalProductsPurchased
FROM [${dbName}].[dbo].[DimCustomer] d
JOIN CustomerPurchases cp ON d.CustomerKey = cp.CustomerKey;"\n\n`;
    
    examples += `${startIndex + 3}. Provide me the top 3 customers with their products and sales?,\n`;
    examples += `Your SQL Query will be like "WITH TopCustomers AS (
    SELECT TOP 3 CustomerKey, SUM(SalesAmount) AS TotalSales
    FROM [${dbName}].[dbo].[FactInternetSales]
    GROUP BY CustomerKey
    ORDER BY TotalSales DESC
),
CustomerProductSales AS (
    SELECT CustomerKey, ProductKey, SUM(SalesAmount) AS ProductSales
    FROM [${dbName}].[dbo].[FactInternetSales]
    GROUP BY CustomerKey, ProductKey
)
SELECT 
    dc.CustomerKey,
    dc.FirstName,
    dc.LastName,
    dp.EnglishProductName AS Product,
    cps.ProductSales
FROM TopCustomers tc
JOIN [${dbName}].[dbo].[DimCustomer] dc ON tc.CustomerKey = dc.CustomerKey
JOIN CustomerProductSales cps ON tc.CustomerKey = cps.CustomerKey
JOIN [${dbName}].[dbo].[DimProduct] dp ON cps.ProductKey = dp.ProductKey
ORDER BY tc.TotalSales DESC, cps.ProductSales DESC;"\n\n`;
    
    return examples;
  }
  
  // For other databases, generate examples for each table
  let examples = 'Below are some general examples of questions:\n\n';
  
  // Sort tables by name for consistency
  const sortedTables = [...tables].sort((a, b) => {
    if (a.name && b.name) {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  // First, generate count examples for each table using the specific format
  sortedTables.forEach((table, index) => {
    if (table.name) {
      // Add count example for each table with database.dbo prefix
      examples += `${index + 1}. Calculate me the total number of records in ${table.name}?,\n`;
      examples += `Your SQL Query will be like "SELECT COUNT(*) AS TotalRecords FROM [${dbName}].[dbo].[${table.name}];"\n\n`;
    }
  });
  
  // After generating count examples for all tables, add a few more complex examples
  const tableCount = sortedTables.length;
  let exampleIndex = tableCount + 1;
  
  // Find a few representative tables to use for more complex examples
  const exampleTables = sortedTables.slice(0, Math.min(4, sortedTables.length));
  
  if (exampleTables.length >= 1) {
    const table = exampleTables[0];
    examples += `${exampleIndex}. Show me the top 10 records from ${table.name}?,\n`;
    examples += `Your SQL Query will be like "SELECT TOP 10 * FROM [${dbName}].[dbo].[${table.name}];"\n\n`;
    exampleIndex++;
  }
  
  if (exampleTables.length >= 2) {
    const table1 = exampleTables[0];
    const table2 = exampleTables[1];
    
    // Find potential join columns (looking for similar column names that might be keys)
    let joinColumn1 = "ID";
    let joinColumn2 = "ID";
    
    if (table1.columnDetails && table2.columnDetails) {
      const table1Columns = table1.columnDetails.map((col: any) => col.name || "");
      const table2Columns = table2.columnDetails.map((col: any) => col.name || "");
      
      // Look for matching columns or columns with KEY or ID in the name
      for (const col1 of table1Columns) {
        if (col1.toUpperCase().includes('KEY') || col1.toUpperCase().includes('ID')) {
          joinColumn1 = col1;
          break;
        }
      }
      
      for (const col2 of table2Columns) {
        if (col2.toUpperCase().includes('KEY') || col2.toUpperCase().includes('ID')) {
          joinColumn2 = col2;
          break;
        }
      }
    }
    
    examples += `${exampleIndex}. Join ${table1.name} with ${table2.name}?,\n`;
    examples += `Your SQL Query will be like "SELECT t1.*, t2.*\nFROM [${dbName}].[dbo].[${table1.name}] t1\nJOIN [${dbName}].[dbo].[${table2.name}] t2 ON t1.${joinColumn1} = t2.${joinColumn2};"\n\n`;
    exampleIndex++;
  }
  
  if (exampleTables.length >= 1) {
    const table = exampleTables[0];
    let groupByColumn = "";
    
    // Try to find a suitable column for GROUP BY
    if (table.columnDetails) {
      const columns = table.columnDetails.map((col: any) => col.name || "");
      
      // Look for a categorical column (avoiding ID columns)
      for (const col of columns) {
        if (!col.toUpperCase().includes('ID') && 
            !col.toUpperCase().includes('KEY') && 
            !col.toUpperCase().includes('DATE')) {
          groupByColumn = col;
          break;
        }
      }
      
      // If no good categorical column was found, just use the first column
      if (!groupByColumn && columns.length > 0) {
        groupByColumn = columns[0];
      }
    }
    
    if (groupByColumn) {
      examples += `${exampleIndex}. Count records in ${table.name} grouped by ${groupByColumn}?,\n`;
      examples += `Your SQL Query will be like "SELECT ${groupByColumn}, COUNT(*) AS Count\nFROM [${dbName}].[dbo].[${table.name}]\nGROUP BY ${groupByColumn}\nORDER BY Count DESC;"\n\n`;
      exampleIndex++;
    }
  }
  
  // Add a filter example
  if (exampleTables.length >= 1) {
    const table = exampleTables[0];
    let filterColumn = "";
    
    // Try to find a suitable column for filtering
    if (table.columnDetails) {
      const columns = table.columnDetails.map((col: any) => col.name || "");
      
      // Look for a numeric column
      for (const col of columns) {
        if (col.toUpperCase().includes('AMOUNT') || 
            col.toUpperCase().includes('PRICE') || 
            col.toUpperCase().includes('COST') ||
            col.toUpperCase().includes('QUANTITY')) {
          filterColumn = col;
          break;
        }
      }
      
      // If no good numeric column was found, just use the first column
      if (!filterColumn && columns.length > 0) {
        filterColumn = columns[0];
      }
    }
    
    if (filterColumn) {
      examples += `${exampleIndex}. Get all records from ${table.name} where ${filterColumn} is greater than a specific value?,\n`;
      examples += `Your SQL Query will be like "SELECT * FROM [${dbName}].[dbo].[${table.name}] WHERE ${filterColumn} > [value];"\n\n`;
    }
  }
  
  return examples;
}
