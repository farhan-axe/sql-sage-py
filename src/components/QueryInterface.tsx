
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo } from "@/types/database";
import DataDisplay from "./DataDisplay";
import { RotateCcw, PlayCircle, XCircle } from "lucide-react";

interface QueryInterfaceProps {
  isConnected: boolean;
  databaseInfo: DatabaseInfo | null;
}

const QueryInterface = ({ isConnected, databaseInfo }: QueryInterfaceProps) => {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const fetchWithTimeout = async (url: string, options: RequestInit, abortController: AbortController) => {
    try {
      const response = await fetch(url, {
        ...options,
        signal: abortController.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out or was terminated');
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

    setIsGenerating(true);
    setGeneratedQuery(""); // Clear any previous query
    setQueryResults(null); // Clear any previous results
    
    const newController = new AbortController();
    setController(newController);
    
    try {
      console.log("Starting query generation...");
      
      // Generate the SQL query using the API
      const generateResponse = await fetchWithTimeout(
        'http://localhost:3001/api/sql/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            databaseInfo
          }),
        },
        newController
      );

      const generatedData = await generateResponse.json();
      const cleanedQuery = extractSQLQuery(generatedData.query);
      console.log("Generated query:", cleanedQuery);
      
      if (!cleanedQuery) {
        throw new Error('Failed to extract a valid SQL query from the response');
      }
      
      setGeneratedQuery(cleanedQuery);
      toast({
        title: "Query generated successfully",
      });
    } catch (error) {
      console.error("Error during query generation:", error);
      let errorMessage = "Failed to generate query";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Detailed error:', error);
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setController(null);
    }
  };

  const handleQueryExecution = async () => {
    if (!generatedQuery || !databaseInfo) {
      toast({
        title: "No query to execute",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    const newController = new AbortController();
    setController(newController);
    
    try {
      console.log("Executing query with config:", {
        query: generatedQuery,
        databaseInfo: databaseInfo.connectionConfig
      });

      const executeResponse = await fetchWithTimeout(
        'http://localhost:3001/api/sql/execute',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: generatedQuery,
            databaseInfo: databaseInfo.connectionConfig
          }),
        },
        newController
      );

      const { results } = await executeResponse.json();
      console.log("Query results:", results);
      setQueryResults(results);
      
      toast({
        title: "Query executed successfully",
      });
    } catch (error) {
      console.error("Error during query execution:", error);
      let errorMessage = "Failed to execute query";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Detailed error:', error);
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
      setController(null);
    }
  };

  const terminateOperation = () => {
    if (controller) {
      controller.abort();
      setController(null);
      setIsGenerating(false);
      setIsExecuting(false);
      toast({
        title: "Operation terminated",
        description: "The current operation has been terminated",
      });
    }
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
        <div className="flex gap-2">
          <Button 
            onClick={handleQueryGeneration}
            disabled={isGenerating || isExecuting || !question.trim()}
            className="flex-1"
            variant={isGenerating ? "secondary" : "default"}
          >
            {isGenerating ? "Generating Query..." : "Generate Query"}
          </Button>
          
          {(isGenerating || isExecuting) && (
            <Button 
              onClick={terminateOperation}
              variant="destructive"
              className="gap-1"
            >
              <XCircle size={18} />
              Terminate
            </Button>
          )}
        </div>
      </div>

      {generatedQuery && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Generated SQL Query</h3>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
            <code className="text-sm">{generatedQuery}</code>
          </pre>
          <Button 
            onClick={handleQueryExecution}
            disabled={isExecuting || isGenerating}
            className="w-full flex items-center justify-center gap-2"
          >
            <PlayCircle size={18} />
            Execute Query
          </Button>
        </div>
      )}

      {queryResults && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Query Results</h3>
          <DataDisplay data={queryResults} />
        </div>
      )}
    </div>
  );
};

export default QueryInterface;
