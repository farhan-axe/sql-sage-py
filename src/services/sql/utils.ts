
/**
 * Utility functions for SQL server operations
 */

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
  
  // Add political and general knowledge indicators with stronger matching patterns
  const politicalTerms = [
    "president",
    "prime minister",
    "minister",
    "government",
    "country",
    "politics",
    "election",
    "leader",
    "nation",
    "capital",
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
    "constitution"
  ];
  
  const countryNames = [
    "pakistan",
    "india",
    "china",
    "usa",
    "united states",
    "russia",
    "europe",
    "africa",
    "asia",
    "america",
    "canada",
    "australia",
    "japan",
    "germany",
    "france",
    "uk",
    "united kingdom",
    "brazil",
    "mexico"
  ];
  
  // Non-database topics combined from political terms and other general knowledge areas
  const nonDatabaseTopics = [
    ...politicalTerms,
    ...countryNames,
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
  
  // Add specific political question patterns to catch questions like "who is the president of X"
  const politicalQuestionPatterns = [
    /who is the president/i,
    /who is president/i,
    /current president/i,
    /who is the prime minister/i,
    /who is prime minister/i,
    /who (leads|runs|governs)/i,
    /who is the (leader|ruler|king|queen)/i,
    /capital of/i,
    /largest city in/i,
    /population of/i
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
  
  // Check specifically for political questions patterns
  const hasPoliticalQuestionPattern = politicalQuestionPatterns.some(pattern =>
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
  
  // Check for presence of database schema/table names in the question
  // This helps identify if the question is referencing actual database objects
  const hasDatabaseTerms = databaseRelatedTerms.some(term => 
    normalizedText.includes(term.toLowerCase())
  );
  
  // Special handling for political questions about countries
  // If we detect both political patterns and country names, it's likely a factual question
  if (hasPoliticalQuestionPattern && 
      countryNames.some(country => normalizedText.includes(country.toLowerCase()))) {
    return true; // Block political questions about countries
  }
  
  // Give special treatment to questions that clearly contain demographic terms
  if (hasDemographicTerms) {
    // If it has demographic terms, only block if it also has profanity or explicit political references
    return hasProfanity || (hasNonDatabaseTopic && !hasDatabaseTerms);
  }
  
  // If the question contains other database terms, don't block it
  if (hasDatabaseTerms && !hasPoliticalQuestionPattern) {
    return false;
  }
  
  // Block if it matches any non-SQL indicator, topic, pattern, or contains profanity
  return hasNonSqlIndicator || 
         hasNonDatabaseTopic || 
         hasGeneralPattern || 
         hasPoliticalQuestionPattern || 
         hasProfanity;
};

