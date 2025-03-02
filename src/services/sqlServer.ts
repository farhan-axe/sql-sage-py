
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
      problematicEntity: undefined, // Added this line to fix the type error
      suggestion: 'Check SQL syntax for missing or incorrect keywords, parentheses, or operators'
    };
  }

  return result;
}
