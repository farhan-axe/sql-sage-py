
// Non-SQL Response Detection for Frontend

/**
 * Evaluates if the user's question is likely about general knowledge rather than database content.
 * We need to check on the frontend to avoid unnecessary backend calls.
 * 
 * @param text The user's question to evaluate
 * @returns Boolean indicating if this appears to be a non-SQL question
 */
export const isNonSqlResponse = (text: string): boolean => {
  if (!text) return false;
  
  const normalizedText = text.toLowerCase().trim();
  
  // List of patterns indicating general knowledge questions
  const generalKnowledgePatterns = [
    /\bwho is\b/,
    /\bwhat is\b \w+ (in general|in the world)/,
    /\bwhen was\b \w+ (invented|discovered|born|created)/,
    /\bhow (many|much)\b \w+ (in|on) (the world|earth|universe)/,
    /\bweather\b/,
    /\bpresident of\b/,
    /\bcapital of\b/,
    /\bprime minister\b/,
    /\bceo of\b/,
    /\bpopulation of\b/,
    /\bcurrency of\b/,
    /\btell me about\b/,
    /\bexplain\b \w+ (to me)/,
    /\bwhat do you think about\b/,
    /\bwhat's your opinion\b/,
    /\bhow do you\b/,
    /\btell me a joke\b/,
    /\btell me a story\b/,
    /\bwrite\b \w+ (poem|essay|article|story)/,
  ];
  
  // Check for general knowledge patterns
  for (const pattern of generalKnowledgePatterns) {
    if (pattern.test(normalizedText)) {
      console.log(`Non-SQL question detected with pattern: ${pattern}`);
      return true;
    }
  }
  
  // Look for question words without database context
  if (
    (
      normalizedText.startsWith('who') || 
      normalizedText.startsWith('what') || 
      normalizedText.startsWith('when') || 
      normalizedText.startsWith('where') || 
      normalizedText.startsWith('why') || 
      normalizedText.startsWith('how')
    ) && 
    !containsDatabaseTerms(normalizedText)
  ) {
    console.log('Question word without database context detected');
    return true;
  }
  
  return false;
};

/**
 * Checks if the text contains common database-related terms
 */
const containsDatabaseTerms = (text: string): boolean => {
  const databaseTerms = [
    'table', 'database', 'query', 'sql', 'select', 'from', 'where', 'join',
    'count', 'sum', 'avg', 'group by', 'order by', 'data', 'record', 'field',
    'column', 'row', 'value', 'show me', 'find', 'get', 'list', 'display',
    'report', 'total', 'average', 'view', 'schema', 'top'
  ];
  
  return databaseTerms.some(term => text.includes(term));
};
