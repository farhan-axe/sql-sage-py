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
): Promise<{ tables: any[]; promptTemplate: string; queryExamples: string }> {
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
    const promptTemplate = generateDetailedPromptTemplate(data.tables || []);
    
    // Generate SQL query examples based on the schema
    const queryExamples = generateQueryExamples(data.tables || []);
    
    return {
      tables: data.tables || [],
      promptTemplate,
      queryExamples,
    };
  } catch (error) {
    console.error('Parsing error:', error);
    throw error;
  }
}

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
      // Example 2: Select all columns with limit
      examples += `2. Select all columns from ${tableName} (limited to 10 rows):\n\n`;
      examples += '```sql\n';
      examples += `SELECT TOP 10 *\nFROM ${tableName};\n`;
      examples += '```\n\n';
      
      // Example 3: Group by a column if there are enough columns
      if (columns.length >= 2) {
        const groupByColumn = columns.find(col => 
          col.toLowerCase().includes('gender') || 
          col.toLowerCase().includes('status') || 
          col.toLowerCase().includes('type') ||
          col.toLowerCase().includes('city') ||
          col.toLowerCase().includes('province')
        ) || columns[1];
        
        const countColumn = columns[0];
        
        examples += `3. Count records grouped by ${groupByColumn}:\n\n`;
        examples += '```sql\n';
        examples += `SELECT ${groupByColumn}, COUNT(*) AS Count\n`;
        examples += `FROM ${tableName}\n`;
        examples += `GROUP BY ${groupByColumn}\n`;
        examples += `ORDER BY Count DESC;\n`;
        examples += '```\n\n';
        
        // Example 4: Advanced query with multiple conditions
        if (columns.length >= 3) {
          const filterColumn = columns.find(col => 
            col.toLowerCase().includes('age') || 
            col.toLowerCase().includes('date') || 
            col.toLowerCase().includes('completed')
          ) || columns[2];
          
          examples += `4. Advanced query with filtering and aggregation:\n\n`;
          examples += '```sql\n';
          
          if (filterColumn.toLowerCase().includes('age')) {
            examples += `SELECT ${groupByColumn}, AVG(${filterColumn}) AS AverageAge, COUNT(*) AS Count\n`;
            examples += `FROM ${tableName}\n`;
            examples += `WHERE ${filterColumn} > 18\n`;
            examples += `GROUP BY ${groupByColumn}\n`;
            examples += `HAVING COUNT(*) > 1\n`;
            examples += `ORDER BY Count DESC;\n`;
          } else if (filterColumn.toLowerCase().includes('date')) {
            examples += `SELECT ${groupByColumn}, YEAR(${filterColumn}) AS Year, COUNT(*) AS Count\n`;
            examples += `FROM ${tableName}\n`;
            examples += `WHERE ${filterColumn} >= '2020-01-01'\n`;
            examples += `GROUP BY ${groupByColumn}, YEAR(${filterColumn})\n`;
            examples += `ORDER BY Year, Count DESC;\n`;
          } else {
            examples += `SELECT ${groupByColumn}, MAX(${filterColumn}) AS MaxValue, COUNT(*) AS Count\n`;
            examples += `FROM ${tableName}\n`;
            examples += `GROUP BY ${groupByColumn}\n`;
            examples += `ORDER BY MaxValue DESC;\n`;
          }
          
          examples += '```\n';
        }
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

/**
 * Generates a detailed prompt template from table schema information
 * with column types and constraints
 * @param tables Array of table information objects
 * @returns String containing formatted database schema for prompts
 */
function generateDetailedPromptTemplate(tables: any[]): string {
  let template = '';
  
  if (tables.length > 0) {
    template += '### Database Schema:\n';
    
    tables.forEach(table => {
      template += `        The database table '${table.name}' contains the following columns:\n`;
      
      // Extract and format column information with their types and constraints
      if (table.columnDetails && table.columnDetails.length > 0) {
        table.columnDetails.forEach((column: any) => {
          template += `        - ${column.name} (${column.dataType}${column.isNullable ? '' : ', NOT NULL'}): ${column.description || 'No description available'}.\n`;
        });
      } else if (table.schema && table.schema.length > 0) {
        // Fallback to basic schema if detailed column info is not available
        table.schema.forEach((column: string) => {
          template += `        - ${column}\n`;
        });
      }
      
      if (table.primaryKey) {
        template += `        Primary Key: ${table.primaryKey}\n`;
      }
      
      if (table.example) {
        template += `        Example data: ${table.example}\n`;
      }
      
      template += '\n';
    });
  }
  
  return template;
}

/**
 * Original simple template generator (kept for backward compatibility)
 * @param tables Array of table information objects
 * @returns String containing basic formatted database schema
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
  
  // Check if it matches common database-related questions 
  const commonDatabaseQuestions = [
    'top', 'list', 'find', 'show me', 'provide', 'display', 'get', 
    'retrieve', 'calculate', 'sum', 'count', 'average', 'report',
    'customers', 'products', 'orders', 'sales', 'transactions',
    'revenue', 'profit', 'inventory', 'stock', 'price', 'date',
    'total', 'history', 'compare', 'analysis', 'trend', 'detail'
  ];
  
  // If the question contains multiple database-related terms, it's likely a valid question
  const containsDatabaseTerms = commonDatabaseQuestions.filter(term => 
    lowerText.includes(term)
  ).length;
  
  // If it contains at least 3 database-related terms, it's very likely a valid database question
  if (containsDatabaseTerms >= 2) {
    return false;
  }
  
  // Original logic as fallback
  // Check if it contains SQL keywords
  const containsSqlKeywords = [
    'select', 'from', 'where', 'join', 'group by', 
    'order by', 'having', 'insert', 'update', 'delete'
  ].some(keyword => lowerText.includes(keyword));
  
  if (containsSqlKeywords) return false;
  
  // Check for common non-SQL response patterns
  const nonSqlPatterns = [
    'i can\'t', 'cannot', 'unable to', 'don\'t have', 
    'no information', 'not possible', 'sorry', 'apologies'
  ];
  
  // If it contains non-SQL patterns, check further
  if (nonSqlPatterns.some(pattern => lowerText.includes(pattern))) {
    return true;
  }
  
  // For short queries that don't match any pattern above but are clearly asking for data
  if (lowerText.length < 100 && 
      (lowerText.includes('?') || 
       lowerText.includes('show') || 
       lowerText.includes('get') ||
       lowerText.includes('find') ||
       lowerText.includes('list') ||
       lowerText.includes('provide'))) {
    return false;
  }
  
  // Default to treating it as a valid query unless it matches specific non-SQL patterns
  return false;
}

/**
 * Sends query generation request to the backend LLM service
 * @param payload The query generation payload including prompt template and examples
 * @returns Promise with the generated SQL query
 */
export async function generateQuery(payload: import('../types/database').QueryGenerationPayload): Promise<string> {
  try {
    // Create a properly formatted LLM request that includes both the prompt template and query examples
    const llmRequest: import('../types/database').LLMQueryGenerationRequest = {
      question: payload.question,
      databaseSchema: payload.databaseInfo.promptTemplate,
      maxRows: payload.maxRows,
      promptTemplate: payload.promptTemplate,
      queryExamples: payload.queryExamples
    };

    const response = await fetch('http://localhost:3001/api/sql/generate-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(llmRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.query || '';
  } catch (error) {
    console.error('Query generation error:', error);
    throw error;
  }
}
