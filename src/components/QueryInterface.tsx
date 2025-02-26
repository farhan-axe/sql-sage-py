
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo } from "@/types/database";
import DataDisplay from "./DataDisplay";

interface QueryInterfaceProps {
  isConnected: boolean;
  databaseInfo: DatabaseInfo | null;
}

const QueryInterface = ({ isConnected, databaseInfo }: QueryInterfaceProps) => {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [queryResults, setQueryResults] = useState<any[] | null>(null);

  const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 120000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
      }
      throw error;
    }
  };

  const extractSQLQuery = (text: string): string => {
    // First, try to extract query from SQL code blocks
    const sqlBlockMatch = text.match(/```sql\s*([\s\S]*?)\s*```/i);
    if (sqlBlockMatch) {
      return sqlBlockMatch[1].trim();
    }

    // If no SQL blocks found, try to extract query starting with SQL keywords
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'];
    const lines = text.split('\n');
    const queryLines = [];
    let foundQuery = false;

    for (const line of lines) {
      const upperLine = line.toUpperCase().trim();
      
      // Start capturing when we find a SQL keyword
      if (sqlKeywords.some(keyword => upperLine.startsWith(keyword))) {
        foundQuery = true;
      }

      // If we're in query mode and line isn't empty or explanatory text
      if (foundQuery && 
          line.trim() !== '' && 
          !line.toLowerCase().includes('here') &&
          !line.toLowerCase().includes('query:') &&
          !line.toLowerCase().includes('sql query:')) {
        queryLines.push(line);
      }
    }

    return queryLines.join('\n').trim();
  };

  const handleQueryGeneration = async () => {
    if (!question.trim() || !databaseInfo) {
      toast({
        title: "Please enter a question and ensure database is connected",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedQuery(""); // Clear any previous query
    setQueryResults(null); // Clear any previous results
    
    try {
      console.log("Starting query generation...");
      
      // First, generate the SQL query using the API
      const generateResponse = await fetchWithTimeout(
        'http://localhost:3001/api/sql/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            question,
            databaseInfo
          }),
        },
        120000 // Increased timeout to 120 seconds for Ollama
      );

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.detail || 'Failed to generate query');
      }

      const { query } = await generateResponse.json();
      const cleanedQuery = extractSQLQuery(query);
      console.log("Generated query:", cleanedQuery);
      
      if (!cleanedQuery) {
        throw new Error('Failed to extract a valid SQL query from the response');
      }
      
      setGeneratedQuery(cleanedQuery);

      // Execute the generated query
      console.log("Executing query...");
      const executeResponse = await fetchWithTimeout(
        'http://localhost:3001/api/sql/execute',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            query: cleanedQuery,
            databaseInfo: {
              server: databaseInfo.connectionConfig.server,
              database: databaseInfo.connectionConfig.database,
              useWindowsAuth: databaseInfo.connectionConfig.useWindowsAuth,
              username: databaseInfo.connectionConfig.username,
              password: databaseInfo.connectionConfig.password
            }
          }),
        },
        60000
      );

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.detail || 'Failed to execute query');
      }

      const { results } = await executeResponse.json();
      console.log("Query results:", results);
      setQueryResults(results);
      
      toast({
        title: "Query executed successfully",
      });
    } catch (error) {
      setIsLoading(false);
      let errorMessage = "Failed to generate or execute query";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message === 'Request timed out') {
          errorMessage = "The request took too long to complete. Please try again.";
        }
        console.error('Detailed error:', error);
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
    setIsLoading(false);
  };

  if (!isConnected || !databaseInfo) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 text-lg">
          Connect to a database to start querying
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="question" className="text-sm font-medium text-gray-700">
          Ask a question about your data
        </label>
        <Textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Show me the sales from last year"
          className="h-24"
        />
        <Button 
          onClick={handleQueryGeneration}
          disabled={isLoading || !question.trim()}
          className="w-full"
        >
          {isLoading ? "Generating Query..." : "Generate Query"}
        </Button>
      </div>

      {generatedQuery && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Generated SQL Query</h3>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
            <code className="text-sm">{generatedQuery}</code>
          </pre>
        </div>
      )}

      {queryResults && (
        <DataDisplay data={queryResults} />
      )}
    </div>
  );
};

export default QueryInterface;
