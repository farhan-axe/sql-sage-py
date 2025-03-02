
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo } from "@/types/database";
import DataDisplay from "./DataDisplay";
import { RotateCcw, PlayCircle, XCircle, Clock } from "lucide-react";
import { terminateSession } from "@/services/sqlServer";

interface QueryInterfaceProps {
  isConnected: boolean;
  databaseInfo: DatabaseInfo | null;
  onSessionTerminate: (success: boolean) => void;
}

const QueryInterface = ({ isConnected, databaseInfo, onSessionTerminate }: QueryInterfaceProps) => {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isGenerating || isExecuting) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      startTimeRef.current = null;
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isGenerating, isExecuting]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    const sqlBlockMatch = text.match(/```sql\s*([\s\S]*?)\s*```/i);
    if (sqlBlockMatch) {
      return sqlBlockMatch[1].trim();
    }

    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'];
    const lines = text.split('\n');
    const queryLines = [];
    let foundQuery = false;

    for (const line of lines) {
      const upperLine = line.toUpperCase().trim();
      
      if (sqlKeywords.some(keyword => upperLine.startsWith(keyword))) {
        foundQuery = true;
      }

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
    
    const timeout = setTimeout(() => {
      if (controller) {
        toast({
          title: "Operation taking too long",
          description: "The query generation is taking longer than 3 minutes. Consider terminating it.",
          variant: "destructive",
        });
      }
    }, 180000);
    
    setSessionTimeout(timeout);
    
    try {
      console.log("Starting query generation...");
      
      const generateResponse = await fetchWithTimeout(
        'http://localhost:3001/api/sql/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            databaseInfo,
            maxRows: 200
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
      
      let finalQuery = cleanedQuery;
      if (finalQuery.toUpperCase().trim().startsWith('SELECT') && 
          !finalQuery.toUpperCase().includes('TOP ')) {
        finalQuery = finalQuery.replace(/SELECT/i, 'SELECT TOP 200');
      }
      
      setGeneratedQuery(finalQuery);
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
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        setSessionTimeout(null);
      }
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
    
    const timeout = setTimeout(() => {
      if (controller) {
        toast({
          title: "Operation taking too long",
          description: "The query execution is taking longer than 3 minutes. Consider terminating it.",
          variant: "destructive",
        });
      }
    }, 180000);
    
    setSessionTimeout(timeout);
    
    try {
      console.log("Executing query with config:", {
        query: generatedQuery,
        databaseInfo: databaseInfo.connectionConfig,
        maxRows: 200
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
            databaseInfo: databaseInfo.connectionConfig,
            maxRows: 200
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
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        setSessionTimeout(null);
      }
    }
  };

  const terminateOperation = async () => {
    if (controller) {
      controller.abort();
      setController(null);
      setIsGenerating(false);
      setIsExecuting(false);
      
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        setSessionTimeout(null);
      }
      
      toast({
        title: "Operation terminated",
        description: "The current operation has been terminated",
      });
      
      if (databaseInfo && databaseInfo.connectionConfig) {
        try {
          const { server, database, useWindowsAuth, username, password } = databaseInfo.connectionConfig;
          
          console.log("Attempting to terminate backend session...");
          const success = await terminateSession(
            server,
            database,
            useWindowsAuth,
            useWindowsAuth ? undefined : { username, password }
          );
          
          console.log("Session termination result:", success);
          onSessionTerminate(success);
        } catch (error) {
          console.error("Failed to terminate session on the backend:", error);
          // Call onSessionTerminate with true to avoid disrupting the UI flow
          // even if the backend termination failed
          onSessionTerminate(true);
        }
      }
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
            {isGenerating ? (
              <>
                <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                Generating Query...
              </>
            ) : (
              "Generate Query"
            )}
          </Button>
          
          {(isGenerating || isExecuting) && (
            <>
              <Button 
                onClick={terminateOperation}
                variant="destructive"
                className="gap-1"
                title="Terminate operation (if taking too long)"
              >
                <XCircle size={18} />
                Terminate
              </Button>
              <div className="flex items-center justify-center gap-1 px-3 bg-gray-100 rounded-md border border-gray-200">
                <Clock size={16} className="text-gray-500" />
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {generatedQuery && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Generated SQL Query</h3>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
            <code className="text-sm">{generatedQuery}</code>
          </pre>
          <div className="flex gap-2">
            <Button 
              onClick={handleQueryExecution}
              disabled={isExecuting || isGenerating}
              className="flex-1 items-center justify-center gap-2"
              variant={isExecuting ? "secondary" : "default"}
            >
              {isExecuting ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  Executing Query...
                </>
              ) : (
                <>
                  <PlayCircle size={18} />
                  Execute Query
                </>
              )}
            </Button>
            {isExecuting && (
              <div className="flex items-center justify-center gap-1 px-3 bg-gray-100 rounded-md border border-gray-200">
                <Clock size={16} className="text-gray-500" />
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {queryResults && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Query Results {queryResults.length > 0 && <span className="text-xs text-gray-500">(Limited to 200 rows)</span>}
          </h3>
          <DataDisplay data={queryResults} />
        </div>
      )}
    </div>
  );
};

export default QueryInterface;
