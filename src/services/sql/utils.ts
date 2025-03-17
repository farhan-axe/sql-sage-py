import { isNonSqlResponsePy } from "./utils.py";

/**
 * Determines if the input appears to be a non-database question
 * @param input User's question
 * @returns Boolean indicating if this is likely a non-database question
 */
export function isNonSqlResponse(input: string): boolean {
  // This is a client-side check before sending to the server
  // For more precise checks, the server also uses the Python implementation
  
  // Convert to lower case for case-insensitive matching
  const lowerInput = input.toLowerCase();
  
  // Define phrases that suggest this is a general knowledge question
  const nonDatabasePhrases = [
    "who is", "what is", "when was", "where is", "why is", "how do",
    "meaning of", "define", "explanation", "tell me about", "history of",
    "recipe", "weather", "news", "sports", "movie", "song", "book",
    "president", "capital", "population", "distance", "convert", "translate",
    "calculate", "solve", "philosophy", "religion", "politics", "celebrity",
    "gossip", "joke", "funny", "meme", "picture", "image", "photo", "video",
    "tutorial", "how to", "instructions", "steps to", "guide for", "help me",
    "assist me", "advice on", "suggestion", "recommendation", "opinion",
    "thoughts", "feeling", "emotion", "psychology", "therapy", "healthcare",
    "medical", "symptom", "diagnosis", "treatment", "cure", "medicine",
    "exam", "test", "quiz", "assignment", "homework", "mathematics", "physics",
    "chemistry", "biology", "geography", "astronomy", "dinosaur", "animal",
    "plant", "mineral", "element", "compound", "molecule", "atom", "particle",
    "quantum", "relativity", "gravity", "universe", "galaxy", "planet", "star",
    "sun", "moon", "earth", "mars", "jupiter", "space", "nasa", "cosmos",
    "evolution", "origin", "creation", "god", "deity", "religion", "worship",
    "prayer", "spirituality", "enlightenment", "meditation", "mindfulness",
    "consciousness", "artificial intelligence", "machine learning", "algorithm",
    "dataset", "neural network", "deep learning", "ai system", "computer vision",
    "natural language processing", "robotics", "automation", "programming",
    "coding", "software", "hardware", "network", "internet", "browser", "website",
    "webpage", "social media", "facebook", "twitter", "instagram", "tiktok",
    "youtube", "google", "apple", "microsoft", "amazon", "smartphone", "laptop",
    "tablet", "gadget", "device", "technology", "innovation", "invention",
    "discovery", "achievement", "accomplishment", "success", "failure", "challenge",
    "obstacle", "problem", "solution", "resolution", "strategy", "tactic",
    "approach", "method", "technique", "procedure", "process", "operation", 
    "action", "activity", "task", "job", "career", "profession", "occupation",
    "employment", "business", "company", "corporation", "organization", 
    "institution", "establishment", "enterprise", "startup", "entrepreneur",
    "founder", "ceo", "executive", "manager", "leader", "boss", "supervisor",
    "employee", "worker", "staff", "team", "group", "community", "society",
    "culture", "tradition", "custom", "habit", "practice", "ritual", "ceremony", 
    "celebration", "festival", "holiday", "vacation", "trip", "journey", "travel",
    "adventure", "exploration", "expedition", "mission", "quest", "dream", "goal",
    "objective", "aim", "purpose", "intention", "motivation", "inspiration",
    "aspiration", "ambition", "desire", "want", "need", "requirement", "essential",
    "necessary", "important", "significant", "crucial", "critical", "vital",
    "fuck", "Fuck", "prime minister"
  ];
  
  // Check for non-database phrases at the start of input
  for (const phrase of nonDatabasePhrases) {
    if (lowerInput.startsWith(phrase + " ") || 
        lowerInput === phrase ||
        lowerInput.includes(" " + phrase + " ")) {
      return true;
    }
  }
  
  // If client-side check is inconclusive, we'll rely on the server-side Python check
  return false;
}

/**
 * Formats SQL query results for display in the UI
 * @param results SQL query results
 * @returns Formatted results
 */
export function formatQueryResults(results: any[]): any[] {
  if (!results || results.length === 0) {
    return [];
  }
  
  return results.map(row => {
    const formattedRow: any = {};
    
    // Format each value in the row
    Object.entries(row).forEach(([key, value]) => {
      // Handle different data types appropriately
      if (value instanceof Date) {
        // Format dates as readable strings
        formattedRow[key] = value.toLocaleString();
      } else if (typeof value === 'number') {
        // For numbers, check if it's a decimal/money value
        if (Number.isInteger(value)) {
          formattedRow[key] = value;
        } else {
          // Format decimal numbers to 2 decimal places
          formattedRow[key] = Number(value.toFixed(2));
        }
      } else if (value === null || value === undefined) {
        // Replace null/undefined with a clear indicator
        formattedRow[key] = 'NULL';
      } else {
        // Keep other values as is
        formattedRow[key] = value;
      }
    });
    
    return formattedRow;
  });
}
