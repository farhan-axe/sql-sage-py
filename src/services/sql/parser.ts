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
    
    // Try to parse the response as JSON, with better error handling
    try {
      const data = JSON.parse(responseText);
      
      // Map the response correctly
      const tables = data.tables || [];
      
      // Check if tables is empty or undefined and provide better logging
      if (!tables || tables.length === 0) {
        console.warn("Received empty tables from server, data:", JSON.stringify(data));
        
        // Instead of throwing an error, we'll provide a more helpful template and examples
        const noTablesMessage = "No tables found in the selected database. The schema might be empty or you might not have permissions to access it.";
        const schemaPlaceholder = "Below is the database schema\n\n" + noTablesMessage;
        
        return {
          tables: [],
          promptTemplate: schemaPlaceholder,
          queryExamples: "## Example Queries\n\nNo tables available to generate examples. Please make sure the database contains tables and you have permission to access them.",
          connectionConfig: {
            server,
            database,
            useWindowsAuth,
            ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password })
          }
        };
      }
      
      console.log(`Parsed schema successfully with ${tables.length} tables`);
      
      // Generate prompt template from the tables data
      let promptTemplate = "Below is the database schema\n\n";
      tables.forEach((table: any) => {
        if (table.name) {
          // Use tableSchema from the API response instead of hardcoded 'dbo'
          const schemaName = table.tableSchema || 'dbo';
          const displayName = table.displayName || table.name;
          const primaryKey = table.primaryKey || 'None defined';
          
          promptTemplate += `There is table name ${displayName} used for calculating records based on ${primaryKey} and below are the columns mentioned:\n\n`;
          promptTemplate += `SELECT\n`;
          
          if (table.columns && table.columns.length > 0) {
            table.columns.forEach((column: any, index: number) => {
              // Format column information
              const columnName = typeof column === 'string' ? column : column.name;
              const columnType = column.type ? ` ${column.type}` : '';
              const isPK = column.isPrimaryKey ? ' /* Primary Key */' : '';
              
              // Add commas after each column except the last one
              if (index < table.columns.length - 1) {
                promptTemplate += `${columnName}${columnType},${isPK}\n`;
              } else {
                promptTemplate += `${columnName}${columnType}${isPK}\n`;
              }
            });
          } else if (table.schema && Array.isArray(table.schema) && table.schema.length > 0) {
            // Fallback to old format if present
            table.schema.forEach((column: string, index: number) => {
              if (index < table.schema.length - 1) {
                promptTemplate += `${column},\n`;
              } else {
                promptTemplate += `${column}\n`;
              }
            });
          }
          
          // Use the tableSchema when available, otherwise construct it
          const fullTableName = `[${database}].[${schemaName}].[${table.name}]`;
          promptTemplate += `FROM ${fullTableName};\n\n`;
          promptTemplate += `Primary Key: ${primaryKey}\n\n`;
        }
      });
      
      // Let the backend generate query examples based on the tables data
      // This ensures examples are dynamically generated
      const queryExamples = data.queryExamples || generateQueryExamples(tables, database);
      console.log("Generated query examples:", queryExamples.substring(0, 200) + "...");
      
      // Return the correctly mapped data
      return {
        tables: tables,
        promptTemplate: promptTemplate,
        queryExamples,
        connectionConfig: {
          server,
          database,
          useWindowsAuth,
          ...(sqlAuth && { username: sqlAuth.username, password: sqlAuth.password })
        }
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
 * Creates vector embeddings from database schema for improved query generation
 * @param databaseInfo The database information with tables to embed
 * @returns Promise that resolves when schema is successfully embedded
 */
export const embedSchema = async (databaseInfo: DatabaseInfo): Promise<{ success: boolean; message: string }> => {
  try {
    console.log("Creating vector embeddings for schema with tables:", databaseInfo.tables.length);
    
    const response = await fetch('http://localhost:3001/api/sql/embed-schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tables: databaseInfo.tables
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return { 
      success: true, 
      message: result.message || "Vector database created successfully" 
    };
  } catch (error) {
    console.error("Error embedding schema:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error creating vector database" 
    };
  }
};

/**
 * Creates vector embeddings from query examples for improved query generation
 * @param databaseInfo The database information with query examples to embed
 * @returns Promise that resolves when examples are successfully embedded
 */
export const embedExamples = async (databaseInfo: DatabaseInfo): Promise<{ success: boolean; message: string }> => {
  try {
    console.log("Creating vector embeddings for query examples");
    
    if (!databaseInfo.queryExamples) {
      return {
        success: false,
        message: "No query examples available to embed"
      };
    }
    
    // Parse examples from the string into array for better server handling
    const examplesText = databaseInfo.queryExamples;
    const exampleSections = examplesText.split("Your SQL Query will be like");
    const examples = exampleSections
      .map(section => section.trim())
      .filter(section => section.length > 0);
      
    console.log(`Parsed ${examples.length} examples from text`);
    
    const response = await fetch('http://localhost:3001/api/sql/embed-examples', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        examples: examples.length > 0 ? examples : examplesText,
        database: databaseInfo.connectionConfig.database
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return { 
      success: true, 
      message: result.message || "Query examples embedded successfully" 
    };
  } catch (error) {
    console.error("Error embedding examples:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error embedding query examples" 
    };
  }
};

/**
 * Searches the schema vectorstore for relevant schema information
 * @param query The natural language query to search for in the schema
 * @returns Promise that resolves to the relevant schema parts
 */
export const searchSchema = async (query: string): Promise<string> => {
  try {
    const response = await fetch('http://localhost:3001/api/sql/search-schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.result || "";
  } catch (error) {
    console.error("Error searching schema:", error);
    throw error;
  }
};

/**
 * Searches the examples vectorstore for relevant query examples
 * @param query The natural language query to search for in examples
 * @returns Promise that resolves to the relevant examples
 */
export const searchQueryExamples = async (query: string): Promise<string> => {
  try {
    const response = await fetch('http://localhost:3001/api/sql/search-examples', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.result || "";
  } catch (error) {
    console.error("Error searching query examples:", error);
    throw error;
  }
};
