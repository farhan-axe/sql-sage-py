/**
 * Generates example SQL queries based on the database schema
 * @param tables Array of table information objects
 * @returns String containing example SQL queries
 */
function generateQueryExamples(tables: any[]): string {
  if (!tables || tables.length === 0) {
    return 'No tables available to generate examples. Please make sure the database contains tables and you have permission to access them.';
  }
  
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
  
  // Generate examples for each table - LIMIT TO 2 EXAMPLES PER TABLE
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
      examples += '```\n'; // Fixed: Removed the extra backtick
      
      // No more examples after this to limit to only 2 examples per table
    }
  });
  
  if (examples.length === 0) {
    return 'Could not generate examples because no table information was available.';
  }
  
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
    
    // Explicitly use the correct URL with protocol and port
    const apiUrl = 'http://localhost:3001/api/sql/connect';
    
    console.log("Sending API request to:", apiUrl);
    
    // Add timeout to prevent hanging connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(config),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log("Server response status:", response.status);
    
    // Check if the response is HTML by looking at content-type header
    const contentType = response.headers.get('content-type');
    const isHtmlResponse = contentType && contentType.includes('text/html');
    
    if (isHtmlResponse) {
      throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. Make sure your backend API is running at ${apiUrl} and returning JSON responses.`);
    }
    
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
    console.log("Response text preview:", responseText.substring(0, 100));
    
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
        throw new Error(`Server returned HTML instead of JSON. Please check if the API server is running correctly at http://localhost:3001 and configured to return JSON responses.`);
      }
      throw new Error(`Failed to parse server response as JSON. The server might not be returning valid JSON data. Response starts with: ${responseText.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('Error connecting to server:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Connection timed out after 30 seconds. Please check if the backend server is running at http://localhost:3001.');
    }
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
  tables: any[];
}> => {
  try {
    console.log(`Parsing database schema for ${database} on ${server}`);
    
    // Explicitly use the correct URL with protocol and port
    const apiUrl = 'http://localhost:3001/api/sql/parse';
    
    // Add timeout to prevent hanging connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        server,
        database,
        useWindowsAuth,
        ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password }),
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Check if the response is HTML by looking at content-type header
    const contentType = response.headers.get('content-type');
    const isHtmlResponse = contentType && contentType.includes('text/html');
    
    if (isHtmlResponse) {
      throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. Make sure your backend API is running at ${apiUrl} and returning JSON responses.`);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Parse database error response:", errorText.substring(0, 200));
      
      // Check if the error response contains HTML
      if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}. This usually indicates that the API server is not running or the endpoint doesn't exist. Make sure your backend API is running at ${apiUrl}.`);
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
    console.log("Response text preview:", responseText.substring(0, 100));
    
    // Add more detailed logging to diagnose the issue
    console.log("Full response from backend:", responseText);
    
    // Try to parse the response as JSON, with better error handling
    try {
      const data = JSON.parse(responseText);
      
      // Add detailed logging to see what's in the parsed data
      console.log("Parsed data from backend:", JSON.stringify(data, null, 2));
      
      // CRITICAL FIX: Backend returns 'tables' but frontend expects 'schema'
      // Map the response correctly based on what we saw in the backend code
      const tables = data.tables || [];
      
      // Check if tables is empty or undefined and provide better logging
      if (!tables || tables.length === 0) {
        console.warn("Received empty tables from server, data:", JSON.stringify(data));
        
        // Instead of throwing an error, we'll provide a more helpful template and examples
        const noTablesMessage = "No tables found in the selected database. The schema might be empty or you might not have permissions to access it.";
        const schemaPlaceholder = "Below is the database schema\n\n" + noTablesMessage;
        
        return {
          schema: [],
          promptTemplate: schemaPlaceholder,
          queryExamples: "## Example Queries\n\nNo tables available to generate examples. Please make sure the database contains tables and you have permission to access them.",
          connectionConfig: {
            server,
            database,
            useWindowsAuth,
            ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password })
          },
          tables: []
        };
      }
      
      console.log(`Parsed schema successfully with ${tables.length} tables`);
      
      // Generate prompt template from the tables data with updated title format
      let promptTemplate = "Below is the database schema\n\n";
      tables.forEach((table: any) => {
        if (table.name) {
          promptTemplate += `Table: ${table.name}\n`;
          if (table.schema && table.schema.length > 0) {
            table.schema.forEach((column: string) => {
              promptTemplate += `- ${column}\n`;
            });
          }
          promptTemplate += `Primary Key: ${table.primaryKey || 'None defined'}\n\n`;
        }
      });
      
      // Generate query examples based on the tables data
      const queryExamples = generateQueryExamples(tables);
      console.log("Generated query examples:", queryExamples.substring(0, 200) + "...");
      
      // Return the correctly mapped data
      return {
        schema: tables, // Use tables data for schema
        promptTemplate: promptTemplate,
        queryExamples,
        connectionConfig: {
          server,
          database,
          useWindowsAuth,
          ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password })
        },
        tables: tables // This matches what the interface expects
      };
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Please check if the API server is running correctly at http://localhost:3001 and configured to return JSON responses.`);
      }
      throw new Error(`Failed to parse server response as JSON. Please check that the API is returning properly formatted JSON data. Response starts with: ${responseText.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('Error parsing database:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Connection timed out after 60 seconds. Please check if the backend server is running at http://localhost:3001.');
    }
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
    // Explicitly use the correct URL with protocol and port
    const apiUrl = 'http://localhost:3001/api/sql/terminate';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
