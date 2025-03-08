
/**
 * Generates example SQL queries based on the database schema
 * @param tables Array of table information objects
 * @param dbName Database name
 * @returns String containing example SQL queries
 */
function generateQueryExamples(tables: any[], dbName: string = ""): string {
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
  if (!text) return false;
  
  const normalizedText = text.toLowerCase();
  
  // Check if the response contains specific indicators of non-SQL content
  const nonSqlIndicators = [
    "i'm sorry",
    "i apologize",
    "i can't",
    "cannot",
    "as an ai",
    "not authorized",
    "not allowed",
    "unable to",
    "don't have access",
    "above my capabilities",
    "outside the scope"
  ];
  
  // Add profanity and inappropriate language detection
  const profanityWords = [
    "fuck", "shit", "ass", "bitch", "damn", "cunt", "dick", "cock", "pussy", "whore",
    "bastard", "asshole", "motherfucker", "bullshit", "horseshit", "douchebag",
    "wanker", "slut", "piss", "twat", "fag", "faggot", "nigger", "nigga",
    "prick", "bollocks"
  ];
  
  // Add political and general knowledge indicators
  // Completely removing demographic terms that might be used in valid database queries
  const nonDatabaseTopics = [
    "president",
    "minister",
    "government",
    "country",
    "politics",
    "election",
    "leader",
    "nation",
    "capital",
    "prime minister",
    "king",
    "queen",
    "mayor",
    "governor",
    "senator",
    "parliament",
    "congress",
    "political",
    "democracy",
    "republican",
    "democratic",
    "party",
    "vote",
    "constitution",
    "history",
    "war",
    "weather",
    "news",
    "sports",
    "entertainment",
    "celebrity",
    "movie",
    "music",
    "actor",
    "singer",
    "pakistan",
    "india",
    "china",
    "usa",
    "united states",
    "europe",
    "africa",
    "asia",
    "religion",
    "religious",
    "islam",
    "muslim",
    "christianity",
    "christian",
    "judaism",
    "jewish",
    "hindu",
    "buddhism",
    "buddhist",
    "atheist",
    "god"
  ];
  
  // Check for common question patterns that are not database-related
  // Improved to exclude database-relevant patterns, especially for demographic data
  const generalKnowledgePatterns = [
    /who is (?!in|from|has|with|the|less|more|highest|lowest|older|younger|above|below|between|male|female|man|woman|age|having|customer|employee|person|user)/i,
    /what is (?!the count|the sum|the average|the min|the max|in|from|has|with|the|less|more|highest|lowest|older|younger|above|below|between|male|female|age|man|woman|having|customer|employee|person|user)/i,
    /when did (?!the transaction|the sale|the event|the entry|the record|the user|the customer|the person|the employee)/i,
    /where is (?!the location|the address|the store|the customer|the product|the user|the person|the employee)/i,
    /how many people (?!purchased|ordered|returned|visited|registered|are|with|having|above|below|between|older|younger|male|female|age)/i,
    /tell me about (?!the data|the table|the schema|the query|the result|the database|the customers|the users|the employees|the people|age|gender)/i
  ];
  
  // Common database-related terms for demographic analysis
  // Expanded this list significantly to cover more demographic query scenarios
  const demographicDataTerms = [
    "age", "gender", "sex", "male", "female", 
    "demographic", "man", "woman", "men", "women",
    "boy", "girl", "boys", "girls", "birth", "dob",
    "date of birth", "year old", "years old", "younger than",
    "older than", "between ages", "age group", "by gender",
    "by age", "age distribution", "gender distribution",
    "age range", "under age", "over age", "less than",
    "more than", "greater than", "show me the age", 
    "list the age", "find age", "count by age", "group by gender"
  ];
  
  // Check for profanity
  const hasProfanity = profanityWords.some(word => 
    normalizedText.includes(word.toLowerCase())
  );
  
  // Check for non-SQL indicators
  const hasNonSqlIndicator = nonSqlIndicators.some(indicator => 
    normalizedText.includes(indicator.toLowerCase())
  );
  
  // Check for political and general knowledge topics
  const hasNonDatabaseTopic = nonDatabaseTopics.some(topic => 
    normalizedText.includes(topic.toLowerCase())
  );
  
  // Check for general knowledge question patterns
  const hasGeneralPattern = generalKnowledgePatterns.some(pattern => 
    pattern.test(normalizedText)
  );
  
  // Check if the question might be related to demographic data
  const hasDemographicTerms = demographicDataTerms.some(term => 
    normalizedText.includes(term.toLowerCase())
  );
  
  // Added more comprehensive database-related terms including analytical operations
  const databaseRelatedTerms = [
    "table", "database", "sql", "query", "select", "row", "column", 
    "join", "data", "record", "count", "sum", "avg", "where", "from", 
    "group by", "order by", "having", "show me", "less than", "more than",
    "greater than", "filter", "sort", "list", "display", "find", "report",
    "analyze", "between", "who", "what", "when", "how many", "tell me",
    "top", "bottom", "first", "last", "total", "average", "minimum", "maximum",
    "highest", "lowest", "equal to", "not equal", "contains", "starts with",
    "ends with", "like", "and", "or", "insert", "update", "delete", "create",
    "alter", "drop", "view", "index", "procedure", "function", "trigger"
  ];
  
  // If the question contains database terms or demographic terms, don't block it
  const hasDatabaseTerms = databaseRelatedTerms.some(term => 
    normalizedText.includes(term.toLowerCase())
  );
  
  // Give special treatment to questions that clearly contain demographic terms
  if (hasDemographicTerms) {
    // If it has demographic terms, only block if it also has profanity or explicit political references
    return hasProfanity || (hasNonDatabaseTopic && !hasDatabaseTerms);
  }
  
  // If the question contains other database terms, don't block it either
  if (hasDatabaseTerms) {
    return false;
  }
  
  // Block if it matches any non-SQL indicator, topic, pattern, or contains profanity
  return hasNonSqlIndicator || hasNonDatabaseTopic || hasGeneralPattern || hasProfanity;
};

// Export the function for external use
export { generateQueryExamples };
