
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
    "i'm sorry",
    "i am sorry",
    "i cannot",
    "i can't",
    "cannot generate",
    "can't generate",
    "unable to generate",
    "doesn't appear to be",
    "does not appear to be",
    "not related to",
    "not a database",
    "not database",
    "no relevant data",
    "no database",
    "data is not available",
    "information is not available",
    "outside the scope",
    "not about the database",
    "can't help",
    "cannot help",
    "don't have information",
    "do not have information",
    "not have access",
    "don't have access",
    "politics",
    "political",
    "opinion",
    "president",
    "election",
    "vote",
    "party",
    "government",
    "congress",
    "senate",
    "democrat",
    "republican",
    "liberal",
    "conservative",
    "fuck",
    "Fuck",
    "prime minister"
  ];
  
  return nonDatabasePhrases.some(phrase => lowerText.includes(phrase));
}
