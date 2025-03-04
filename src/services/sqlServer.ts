/**
 * Generates example SQL queries based on the database schema
 * @param tables Array of table information objects
 * @returns String containing example SQL queries
 */
function generateQueryExamples(tables: any[]): string {
  if (tables.length === 0) return '';
  
  let examples = '';
  
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
        
        examples += `3. Count records grouped by ${groupByColumn}:\n\n`;
        examples += '```sql\n';
        examples += `SELECT ${groupByColumn}, COUNT(*) AS Count\n`;
        examples += `FROM ${tableName}\n`;
        examples += `GROUP BY ${groupByColumn}\n`;
        examples += `ORDER BY Count DESC;\n`;
        examples += '```\n';
      }
    }
  });
  
  return examples;
}

/**
 * Connects to a SQL Server instance and retrieves available databases
 * @param config Connection configuration
 * @returns Promise that resolves to array of database names
 */
export const connectToServer = async (config: { 
  server: string; 
  useWindowsAuth: boolean; 
  username?: string; 
  password?: string; 
}): Promise<string[]> => {
  try {
    console.log("Connecting to server with config:", JSON.stringify({
      server: config.server,
      useWindowsAuth: config.useWindowsAuth,
      username: config.username ? '(provided)' : '(not provided)',
      // Don't log the password for security reasons
    }));
    
    // Update the API endpoint to explicitly use the correct port
    const apiUrl = 'http://localhost:3001/api/sql/connect';
    
    console.log("Sending API request to:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    console.log("Server response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response text:", errorText);
      
      // Check if the error response contains HTML (common for 404, 500, etc.)
      if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually indicates that the API server is not running or the endpoint doesn't exist. Make sure your backend API is running at ${apiUrl}.`);
      }
      
      let errorDetail;
      try {
        const errorData = JSON.parse(errorText);
        errorDetail = errorData.detail || errorData.message || 'Failed to connect to the server';
      } catch (e) {
        errorDetail = 'Failed to connect to the server: ' + errorText;
      }
      
      throw new Error(errorDetail);
    }
    
    const responseText = await response.text();
    console.log("Response text length:", responseText.length);
    
    if (!responseText.trim()) {
      throw new Error('Empty response from server');
    }
    
    // Try to parse the response as JSON, with better error handling
    try {
      const data = JSON.parse(responseText);
      return data.databases || [];
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Please check if the API server is running correctly and configured to return JSON responses.`);
      }
      throw new Error(`Failed to parse server response as JSON. The server might not be returning valid JSON data. Response starts with: ${responseText.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('Error connecting to server:', error);
    throw error;
  }
};

/**
 * Parses database schema and generates query examples
 * @param server Server name
 * @param database Database name
 * @param useWindowsAuth Whether to use Windows Authentication
 * @param sqlAuth SQL Server Authentication credentials (optional)
 * @returns Promise that resolves to database information
 */
export const parseDatabase = async (
  server: string,
  database: string,
  useWindowsAuth: boolean,
  sqlAuth?: { username: string; password: string }
): Promise<{
  schema: any[];
  promptTemplate: string;
  queryExamples: string;
  connectionConfig: { server: string; database: string; useWindowsAuth: boolean; username?: string; password?: string; };
  tables: any[]; // Adding this to match the DatabaseInfo interface
}> => {
  try {
    console.log(`Parsing database schema for ${database} on ${server}`);
    
    // Update to explicitly use port 3001
    const response = await fetch('http://localhost:3001/api/sql/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        server,
        database,
        useWindowsAuth,
        ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password }),
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Parse database error response:", errorText.substring(0, 200));
      
      // Check if the error response contains HTML
      if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually indicates that the API server is not running or the endpoint doesn't exist. Make sure your backend API is running at /api/sql/parse.`);
      }
      
      let errorDetail;
      try {
        const errorData = JSON.parse(errorText);
        errorDetail = errorData.detail || errorData.message || 'Failed to parse database schema';
      } catch (e) {
        errorDetail = 'Failed to parse database: ' + errorText.substring(0, 200);
      }
      
      throw new Error(errorDetail);
    }
    
    const responseText = await response.text();
    console.log("Parse database response length:", responseText.length);
    
    // Try to parse the response as JSON, with better error handling
    try {
      const data = JSON.parse(responseText);
      // Generate query examples
      const queryExamples = generateQueryExamples(data.schema || []);
      
      return {
        schema: data.schema || [],
        promptTemplate: data.promptTemplate || '',
        queryExamples,
        connectionConfig: {
          server,
          database,
          useWindowsAuth,
          ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password })
        },
        tables: data.schema || [] // Use the schema as tables to match the interface
      };
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Please check if the API server is running correctly and configured to return JSON responses.`);
      }
      throw new Error(`Failed to parse server response as JSON. Please check that the API is returning properly formatted JSON data. Response starts with: ${responseText.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('Error parsing database:', error);
    throw error;
  }
};

/**
 * Terminates the current database session
 * @param server Server name
 * @param database Database name
 * @param useWindowsAuth Whether to use Windows Authentication
 * @param sqlAuth SQL Server Authentication credentials (optional)
 * @returns Promise that resolves to success status
 */
export const terminateSession = async (
  server: string,
  database: string,
  useWindowsAuth: boolean,
  sqlAuth?: { username: string; password: string }
): Promise<boolean> => {
  try {
    // Update to explicitly use port 3001
    const response = await fetch('http://localhost:3001/api/sql/terminate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        server,
        database,
        useWindowsAuth,
        ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password }),
      }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error terminating session:', error);
    return false;
  }
};

/**
 * Checks if a response contains non-SQL content
 * @param text Response text to check
 * @returns Boolean indicating whether the response is non-SQL
 */
export const isNonSqlResponse = (text: string): boolean => {
  // Check if the response contains specific indicators of non-SQL content
  const nonSqlIndicators = [
    "I'm sorry",
    "I apologize",
    "I can't",
    "cannot",
    "As an AI",
    "not authorized",
    "not allowed",
    "unable to",
    "don't have access",
    "above my capabilities"
  ];
  
  return nonSqlIndicators.some(indicator => 
    text.toLowerCase().includes(indicator.toLowerCase())
  );
};

// Export the function for external use
export { generateQueryExamples };
