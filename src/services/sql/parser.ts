
/**
 * Functions for parsing SQL database schema
 */
import { DatabaseInfo } from "@/types/database";
import { generateQueryExamples } from "./exampleGenerator";

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
): Promise<DatabaseInfo> => {
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
          // Updated format to match the requested style
          promptTemplate += `There is table name ${table.name} used for calculating records based on ${table.primaryKey || 'None defined'} and below are the columns mentioned:\n\n`;
          promptTemplate += `SELECT\n`;
          
          if (table.schema && table.schema.length > 0) {
            table.schema.forEach((column: string, index: number) => {
              // Add commas after each column except the last one
              if (index < table.schema.length - 1) {
                promptTemplate += `${column},\n`;
              } else {
                promptTemplate += `${column}\n`;
              }
            });
          }
          
          promptTemplate += `FROM [${database}].[dbo].[${table.name}];\n\n`;
          promptTemplate += `Primary Key: ${table.primaryKey || 'None defined'}\n\n`;
        }
      });
      
      // Generate query examples based on the tables data - pass database name
      const queryExamples = generateQueryExamples(tables, database);
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
