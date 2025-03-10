
/**
 * Utility functions for SQL service
 */

/**
 * Check if the response indicates a non-SQL related question
 * or content that should not be executed against the database
 */
export function isNonSqlResponse(text: string): boolean {
  if (!text) {
    return false;
  }
  
  // Convert to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Check for phrases indicating non-database content
  const nonDatabasePhrases = [
    "i'm sorry, i cannot",
    "i am sorry, i cannot",
    "i apologize, but i cannot",
    "i am unable to generate",
    "as an ai language model",
    "cannot provide political",
    "cannot discuss politics",
    "i don't have personal opinions",
    "inappropriate content"
  ];
  
  // Explicit political topics that should be filtered
  const politicalTerms = [
    "democrat party",
    "republican party",
    "liberal agenda",
    "conservative agenda",
    "political opinion",
    "who should i vote for",
    "which party is better"
  ];
  
  // Check for explicit political phrases (these are more specific)
  if (politicalTerms.some(term => lowerText.includes(term))) {
    return true;
  }
  
  // For general phrases, check with more context to avoid false positives
  return nonDatabasePhrases.some(phrase => lowerText.includes(phrase));
}
