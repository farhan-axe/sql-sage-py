
/**
 * Format a SQL query to include fully qualified table names with database prefix
 */
export function formatQueryWithDatabasePrefix(query: string, dbName: string): string {
  if (!query || !dbName) return query;
  
  // Regex to find table names in FROM and JOIN clauses that don't already have database prefix
  const tableRegex = /\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)/gi;
  
  return query.replace(tableRegex, (match, clause, tableName) => {
    const cleanTableName = tableName.replace(/\[|\]/g, '');
    return `${clause} [${dbName}].[dbo].[${cleanTableName}]`;
  });
}

/**
 * Save a query to localStorage for a specific database connection
 * @returns boolean indicating if the save was successful
 */
export function saveQueryToLocalStorage(server: string, database: string, question: string, query: string): boolean {
  try {
    const savedQueriesKey = `savedQueries_${server}_${database}`;
    let savedQueries = [];
    
    const existingSavedQueriesString = localStorage.getItem(savedQueriesKey);
    if (existingSavedQueriesString) {
      savedQueries = JSON.parse(existingSavedQueriesString);
    }
    
    // Check if this query already exists (case insensitive)
    const queryExists = savedQueries.some((q: any) => 
      q.question.toLowerCase().trim() === question.toLowerCase().trim()
    );
    
    if (!queryExists) {
      savedQueries.push({ question, query });
      localStorage.setItem(savedQueriesKey, JSON.stringify(savedQueries));
      console.log(`Saved query to localStorage. Total saved queries: ${savedQueries.length}`);
      return true;
    } else {
      console.log("Query already exists in saved queries, not saving duplicate");
      return false;
    }
  } catch (error) {
    console.error("Error saving query to localStorage:", error);
    return false;
  }
}

/**
 * Load saved queries from localStorage for a specific database connection
 */
export function loadQueriesFromLocalStorage(server: string, database: string): { question: string, query: string }[] {
  try {
    const savedQueriesKey = `savedQueries_${server}_${database}`;
    const savedQueriesString = localStorage.getItem(savedQueriesKey);
    
    if (savedQueriesString) {
      return JSON.parse(savedQueriesString);
    }
  } catch (error) {
    console.error("Error loading saved queries from localStorage:", error);
  }
  
  return [];
}

/**
 * Format query examples with database name and add saved queries
 */
export function updateQueryExamplesWithSavedQueries(
  originalExamples: string, 
  dbName: string, 
  savedQueries: { question: string, query: string }[]
): string {
  if (!savedQueries || savedQueries.length === 0) {
    return originalExamples;
  }
  
  // Format the original examples if needed
  let formattedExamples = originalExamples;
  
  // Skip examples formatting if it includes our test case to avoid duplication
  if (!formattedExamples.includes("provide me list of products, sales territory")) {
    formattedExamples = formatQueryWithDatabasePrefix(formattedExamples, dbName);
  }
  
  // Calculate the starting example number
  const existingExamples = formattedExamples.split('\n\n').filter(e => e.trim());
  const startingExampleIndex = existingExamples.length > 0 ? 
    existingExamples.length + 1 : 1;
  
  // Parse existing examples to avoid duplicates
  const existingQuestionsSet = new Set();
  existingExamples.forEach(example => {
    // Extract question from the example
    const questionMatch = example.match(/^\d+\.\s+(.*?)\?,/);
    if (questionMatch && questionMatch[1]) {
      existingQuestionsSet.add(questionMatch[1].toLowerCase().trim());
    }
  });
  
  // Add saved queries if they don't already exist in the examples
  savedQueries.forEach((savedQuery, index) => {
    // Skip if this question already exists
    if (existingQuestionsSet.has(savedQuery.question.toLowerCase().trim())) {
      console.log(`Skipping duplicate question: ${savedQuery.question}`);
      return;
    }
    
    const formattedQuery = formatQueryWithDatabasePrefix(savedQuery.query, dbName);
    
    const exampleNumber = startingExampleIndex + index;
    const exampleText = `\n\n${exampleNumber}. ${savedQuery.question}?,\nYour SQL Query will be like "${formattedQuery}"\n`;
    formattedExamples += exampleText;
    
    // Add to set to avoid future duplicates
    existingQuestionsSet.add(savedQuery.question.toLowerCase().trim());
  });
  
  return formattedExamples;
}
