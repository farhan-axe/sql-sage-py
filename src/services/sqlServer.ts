import { DatabaseInfo, TableInfo, ConnectionConfig, QueryRefinementAttempt, QueryErrorType, QueryError, QueryVerificationResult } from "@/types/database";

interface SqlConnectionConfig {
  server: string;
  useWindowsAuth: boolean;
  username?: string;
  password?: string;
}

export async function connectToServer(config: SqlConnectionConfig): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:3001/api/sql/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Connection failed');
    }

    const data = await response.json();
    return data.databases;
  } catch (error) {
    console.error('Failed to connect to SQL Server:', error);
    throw error;
  }
}

interface DatabaseParseResult {
  tables: TableInfo[];
  promptTemplate: string;
}

export async function parseDatabase(
  server: string,
  database: string,
  useWindowsAuth: boolean,
  credentials?: { username: string; password: string }
): Promise<DatabaseParseResult> {
  try {
    const response = await fetch('http://localhost:3001/api/sql/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        server,
        database,
        useWindowsAuth,
        maxRows: 200, // Always limit results to 200 rows
        ...credentials,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse database');
    }

    const data = await response.json();
    
    // Generate examples for each table
    const tablesWithExamples = data.tables.map(table => {
      const example = generateTableDescription(table.name, table.schema);
      return {
        ...table,
        example
      };
    });
    
    return {
      tables: tablesWithExamples,
      promptTemplate: generatePromptTemplate(tablesWithExamples),
    };
  } catch (error) {
    console.error('Failed to parse database:', error);
    throw error;
  }
}

function generateTableDescription(tableName: string, schema: string[]): string {
  // Identify primary or important keys
  const keyColumns = schema.filter(col => col.includes('Key') || col.includes('ID'));
  const keyNames = keyColumns.map(col => col.split(' ')[0]).join(', ');
  
  // Generate intelligent descriptions based on table name patterns
  if (tableName.startsWith('Dim')) {
    const dimension = tableName.replace('Dim', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return `Reference table providing ${dimension} attributes identified by ${keyNames || 'primary key'}`;
  } else if (tableName.startsWith('Fact')) {
    const subject = tableName.replace('Fact', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return `Tracks ${subject} metrics and transactions with dimensional references through ${keyNames || 'foreign keys'}`;
  } else if (tableName.includes('Bridge') || tableName.includes('Map')) {
    return `Junction table linking ${keyNames || 'related entities'} in a many-to-many relationship`;
  } else {
    return `Stores ${tableName.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} data with ${schema.length} attributes`;
  }
}

function generatePromptTemplate(tables: TableInfo[]): string {
  let template = `You are a professional SQL query generator for SQL Server. 
Here are the details of the tables:\n\n`;

  tables.forEach((table, index) => {
    template += `${index + 1}. ${table.name} Table
   Schema: ${table.schema.join(', ')}
   Primary Key: ${table.primaryKey}
   Example: ${table.example}\n\n`;
  });

  return template;
}

/**
 * Verifies if the generated SQL query matches the user's question intent
 * @param query The SQL query to verify
 * @param userQuestion The original user question
 * @param databaseInfo Database schema information for context
 * @returns An object with verification result and possibly corrected query
 */
export async function verifySqlQuery(
  query: string, 
  userQuestion: string, 
  databaseInfo: DatabaseInfo
): Promise<QueryVerificationResult> {
  try {
    // Skip verification for empty queries or non-SQL content
    if (!query || isNonSqlResponse(query)) {
      return { isValid: false, reason: "Generated content is not a valid SQL query" };
    }

    // Basic validation - check if it has basic SQL structure
    if (!query.toLowerCase().includes('select') || !query.toLowerCase().includes('from')) {
      return { isValid: false, reason: "Missing basic SQL SELECT...FROM structure" };
    }

    // Check if query references tables that exist in the database
    const tableNames = databaseInfo.tables.map(t => t.name.toLowerCase());
    const queryTablesReferenced = extractTablesFromQuery(query);
    
    const invalidTables = queryTablesReferenced.filter(
      table => !tableNames.includes(table.toLowerCase())
    );
    
    if (invalidTables.length > 0) {
      return { 
        isValid: false, 
        reason: `Query references non-existent tables: ${invalidTables.join(', ')}` 
      };
    }

    // Check if query seems to address the user's question by comparing keywords
    const userQuestionKeywords = extractKeywords(userQuestion);
    const queryKeywords = extractKeywords(query);
    
    // Calculate what percentage of user question keywords appear in the query
    const matchedKeywords = userQuestionKeywords.filter(
      keyword => queryKeywords.some(qKeyword => qKeyword.includes(keyword) || keyword.includes(qKeyword))
    );
    
    const keywordMatchPercentage = matchedKeywords.length / userQuestionKeywords.length;
    
    // If less than 30% of keywords match, the query might not address the question
    if (keywordMatchPercentage < 0.3 && userQuestionKeywords.length > 2) {
      return { 
        isValid: false, 
        reason: "Query may not address the user's question (low keyword match)" 
      };
    }

    // If we've passed all checks, the query is likely valid
    return { isValid: true };
  } catch (error) {
    console.error("Error in query verification:", error);
    // Default to accepting the query if verification fails
    return { isValid: true, reason: "Verification error, accepting query by default" };
  }
}

/**
 * Extracts table names referenced in a SQL query
 */
function extractTablesFromQuery(query: string): string[] {
  // Basic extraction of table names that follow "FROM" or "JOIN"
  const tables: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  // Extract tables after FROM
  const fromMatches = lowerQuery.match(/from\s+([a-z0-9_\[\]\.]+)/gi);
  if (fromMatches) {
    fromMatches.forEach(match => {
      const tableName = match.replace(/from\s+/i, '').trim();
      tables.push(tableName);
    });
  }
  
  // Extract tables after JOIN
  const joinMatches = lowerQuery.match(/join\s+([a-z0-9_\[\]\.]+)/gi);
  if (joinMatches) {
    joinMatches.forEach(match => {
      const tableName = match.replace(/join\s+/i, '').trim();
      tables.push(tableName);
    });
  }
  
  return tables.map(table => table.replace(/[\[\]]/g, '')); // Remove square brackets if present
}

/**
 * Extracts meaningful keywords from text for comparison
 */
function extractKeywords(text: string): string[] {
  // Convert to lowercase and remove special characters
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // Split into words
  const words = normalized.split(/\s+/).filter(word => word.length > 2);
  
  // Filter out common SQL keywords and stopwords
  const stopwords = [
    'select', 'from', 'where', 'and', 'or', 'the', 'is', 'in', 'on', 'at', 'by', 
    'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 
    'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'a', 'an', 
    'as', 'table', 'column', 'row', 'value', 'data', 'query', 'result', 'order', 
    'group', 'having', 'limit', 'offset', 'join', 'left', 'right', 'inner', 'outer',
    'show', 'tell', 'give', 'find', 'get'
  ];
  
  return words.filter(word => !stopwords.includes(word));
}

/**
 * Checks if a query response indicates it's not a valid SQL query
 * or if the user question is not related to the database
 * @param text The query string or user question to check
 * @returns true if the input indicates it's not database-related
 */
export function isNonSqlResponse(text: string): boolean {
  if (!text) return true;

  // Check for phrases that indicate the response is not a SQL query
  const nonSqlIndicators = [
    "database does not contain",
    "no tables related to",
    "cannot answer this question",
    "not possible to answer",
    "doesn't have information",
    "doesn't contain information",
    "I don't have access to",
    "I don't have enough information",
    "the database schema doesn't include",
    "[Your Query Here]",
    "[Your Table Here]",
    "✅ Generated SQL Query:",
    "Raw Ollama response:",
    "<think>",
    "putting it all together"
  ];

  // Additional check for non-database related questions
  const nonDatabaseQuestions = [
    "who is the president",
    "prime minister",
    "capital of",
    "weather in"
  ];
  
  const textLower = text.toLowerCase();
  
  // Check for non-SQL indicators
  if (nonSqlIndicators.some(indicator => textLower.includes(indicator.toLowerCase()))) {
    return true;
  }
  
  // For user questions (not SQL responses), check if they're likely non-database related
  // Only check for obvious non-database questions to avoid false positives
  if (!textLower.includes("select") && !textLower.includes("from") && !textLower.includes("where")) {
    return nonDatabaseQuestions.some(phrase => textLower.includes(phrase.toLowerCase()));
  }
  
  return false;
}

/**
 * Process SQL error and generate a refined query using AI
 * @param query The original SQL query that caused the error
 * @param errorMessage The error message returned from the database
 * @param databaseInfo Database schema information for context
 * @returns A refined SQL query that attempts to fix the error
 */
export async function refineQueryWithError(
  query: string,
  errorMessage: string,
  databaseInfo: DatabaseInfo
): Promise<string> {
  try {
    // Send the query, error, and database info to the backend for refinement
    const response = await fetch('http://localhost:3001/api/sql/refine-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query,
        errorMessage,
        databaseInfo
      }),
    });

    if (!response.ok) {
      console.error(`Error response from refine-query endpoint: ${response.status}`);
      // Return the original query if the refinement fails
      return query;
    }

    const data = await response.json();
    return data.refinedQuery || query;
  } catch (error) {
    console.error("Failed to refine query:", error);
    // Return the original query if an exception occurs
    return query;
  }
}

/**
 * Analyzes a SQL error message to extract useful information
 * for query refinement
 * @param errorMessage The raw error message from the database
 * @returns Structured information about the error
 */
export function analyzeSqlError(errorMessage: string): {
  errorType: string;
  problematicEntity?: string;
  suggestion?: string;
} {
  // Default error analysis
  let result = {
    errorType: 'unknown',
    problematicEntity: undefined,
    suggestion: undefined
  };

  // Check for common SQL Server error patterns
  if (errorMessage.includes('multi-part identifier') && errorMessage.includes('could not be bound')) {
    // Extract the problematic identifier (usually in quotes)
    const match = errorMessage.match(/multi-part identifier "([^"]+)"/);
    const identifier = match ? match[1] : undefined;
    
    result = {
      errorType: 'invalid_column_reference',
      problematicEntity: identifier,
      suggestion: identifier ? 
        `Check the table alias or fully qualify the column name ${identifier}` : 
        'Ensure all column references use the correct table alias'
    };
  } else if (errorMessage.includes('Invalid object name')) {
    // Extract table name
    const match = errorMessage.match(/Invalid object name '([^']+)'/);
    const tableName = match ? match[1] : undefined;
    
    result = {
      errorType: 'invalid_table_name',
      problematicEntity: tableName,
      suggestion: 'Verify the table name exists in the database'
    };
  } else if (errorMessage.includes('syntax error')) {
    result = {
      errorType: 'syntax_error',
      suggestion: 'Check SQL syntax for missing or incorrect keywords, parentheses, or operators'
    };
  }

  return result;
}

export async function terminateSession(
  server: string,
  database: string,
  useWindowsAuth: boolean,
  credentials?: { username: string; password: string }
): Promise<boolean> {
  try {
    // First try to call the backend API
    try {
      const response = await fetch('http://localhost:3001/api/sql/terminate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          server,
          database,
          useWindowsAuth,
          ...credentials,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Session terminated successfully via API");
        return data.success || false;
      }
      
      // If the endpoint is not found (404) or any other error, we'll handle it in the catch block
      console.warn(`Backend API error: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        console.warn("The terminate-session endpoint doesn't exist in the backend");
        console.log("You need to add the terminate-session endpoint to your backend API");
      }
    } catch (apiError) {
      console.warn('Backend API not available:', apiError);
      // Continue to the fallback implementation
    }
    
    // Fallback implementation: 
    // If the backend API is not available or returns an error,
    // we'll consider the session terminated on the frontend side
    console.log('Using fallback session termination (frontend-only)');
    
    // Return true to indicate success from the frontend perspective
    return true;
  } catch (error) {
    console.error("Failed to terminate session completely:", error);
    // Even if there's an error, we want the UI to continue functioning
    return true;
  }
}
