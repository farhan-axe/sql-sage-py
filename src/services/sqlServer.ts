
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
      problematicEntity: undefined,
      suggestion: 'Check SQL syntax for missing or incorrect keywords, parentheses, or operators'
    };
  }

  return result;
}

/**
 * Connects to a SQL Server instance and retrieves available databases
 * @param config Connection configuration
 * @returns Promise with list of available databases
 */
export async function connectToServer(config: {
  server: string;
  useWindowsAuth: boolean;
  username?: string;
  password?: string;
}): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:3001/api/sql/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.databases || [];
  } catch (error) {
    console.error('Connection error:', error);
    throw error;
  }
}

/**
 * Parses a database schema to extract table and column information
 * @param server SQL Server instance name
 * @param database Database name
 * @param useWindowsAuth Whether to use Windows Authentication
 * @param credentials Optional SQL Server authentication credentials
 * @returns Promise with database schema information
 */
export async function parseDatabase(
  server: string,
  database: string,
  useWindowsAuth: boolean,
  credentials?: { username: string; password: string }
): Promise<{ tables: any[]; promptTemplate: string }> {
  try {
    const requestBody = {
      server,
      database,
      useWindowsAuth,
      ...(credentials && { username: credentials.username, password: credentials.password }),
    };

    const response = await fetch('http://localhost:3001/api/sql/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Create a prompt template from table data
    const promptTemplate = generatePromptTemplate(data.tables || []);
    
    return {
      tables: data.tables || [],
      promptTemplate,
    };
  } catch (error) {
    console.error('Parsing error:', error);
    throw error;
  }
}

/**
 * Generates a prompt template from table schema information
 * @param tables Array of table information objects
 * @returns String containing formatted database schema for prompts
 */
function generatePromptTemplate(tables: any[]): string {
  let template = '';
  
  if (tables.length > 0) {
    tables.forEach(table => {
      template += `Table: ${table.name}\n`;
      template += `Columns: ${table.schema.join(', ')}\n`;
      if (table.primaryKey) {
        template += `Primary Key: ${table.primaryKey}\n`;
      }
      template += '\n';
    });
  }
  
  return template;
}

/**
 * Terminates an active SQL Server session
 * @param server SQL Server instance name
 * @param database Database name
 * @param useWindowsAuth Whether to use Windows Authentication
 * @param credentials Optional SQL Server authentication credentials
 * @returns Promise indicating success or failure
 */
export async function terminateSession(
  server: string,
  database: string,
  useWindowsAuth: boolean,
  credentials?: { username: string; password: string }
): Promise<boolean> {
  try {
    const requestBody = {
      server,
      database,
      useWindowsAuth,
      ...(credentials && { username: credentials.username, password: credentials.password }),
    };

    const response = await fetch('http://localhost:3001/api/sql/terminate-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error('Session termination error:', error);
    // Still return true to allow UI to continue, as mentioned in the backend code
    return true;
  }
}

/**
 * Checks if a text response is likely not a SQL query
 * @param text The text to analyze
 * @returns Boolean indicating if the text is likely not SQL
 */
export function isNonSqlResponse(text: string): boolean {
  if (!text) return true;
  
  const lowerText = text.toLowerCase();
  
  // Check if it contains SQL keywords
  const containsSqlKeywords = [
    'select', 'from', 'where', 'join', 'group by', 
    'order by', 'having', 'insert', 'update', 'delete'
  ].some(keyword => lowerText.includes(keyword));
  
  if (!containsSqlKeywords) return true;
  
  // Check for common non-SQL response patterns
  const nonSqlPatterns = [
    'i can\'t', 'cannot', 'unable to', 'don\'t have', 
    'no information', 'not possible', 'sorry', 'apologies'
  ];
  
  // If it contains both SQL keywords and non-SQL patterns, check further
  if (nonSqlPatterns.some(pattern => lowerText.includes(pattern))) {
    // Look for explanatory sentences
    const sentences = text.split(/[.!?]+/);
    // If there are multiple sentences and they're mostly explanatory, 
    // it's likely not a valid SQL query
    if (sentences.length > 2) {
      return true;
    }
  }
  
  return false;
}
