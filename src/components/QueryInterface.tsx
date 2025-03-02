import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo, QueryRefinementAttempt, QueryErrorType } from "@/types/database";
import DataDisplay from "./DataDisplay";
import { RotateCcw, PlayCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { terminateSession, isNonSqlResponse } from "@/services/sqlServer";

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
  const [refinementAttempts, setRefinementAttempts] = useState<QueryRefinementAttempt[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
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

    // Check if the question is likely not database-related before sending to backend
    if (isNonSqlResponse(question)) {
      setQueryError("This question does not appear to be related to database content. Please ask a question about the data in your connected database.");
      toast({
        title: "Non-database question detected",
        description: "Please ask a question about your database content",
        variant: "destructive",
      });
      setGeneratedQuery(""); // Clear any previous query
      setQueryResults(null); // Clear any previous results
      setRefinementAttempts([]); // Clear previous refinement attempts
      return;
    }

    setIsGenerating(true);
    setGeneratedQuery(""); // Clear any previous query
    setQueryResults(null); // Clear any previous results
    setRefinementAttempts([]); // Clear previous refinement attempts
    setQueryError(null); // Clear any previous errors
    
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
            maxRows: 200,
            promptTemplate: databaseInfo.promptTemplate,
            queryExamples: databaseInfo.queryExamples
          }),
        },
        newController
      );

      const generatedData = await generateResponse.json();
      console.log("Generated response:", generatedData.query);
      
      // Check for non-SQL responses, raw model outputs, or informational messages
      if (isNonSqlResponse(generatedData.query)) {
        console.log("Detected non-SQL response, displaying as error message");
        // This is an informational message or error, not a SQL query
        setQueryError("The database does not contain information to answer this question. Please try a different question about your database content.");
        toast({
          title: "Cannot generate SQL query",
          description: "The database does not contain the requested information",
          variant: "destructive",
        });
        setGeneratedQuery(""); // Clear any previously generated query
        return;
      }
      
      // If we get here, we should have a valid SQL query to extract
      const cleanedQuery = extractSQLQuery(generatedData.query);
      console.log("Cleaned query:", cleanedQuery);
      
      if (!cleanedQuery) {
        throw new Error('Failed to extract a valid SQL query from the response');
      }
      
      let finalQuery = cleanedQuery;
      if (finalQuery.toUpperCase().trim().startsWith('SELECT') && 
          !finalQuery.toUpperCase().includes('TOP ')) {
        finalQuery = finalQuery.replace(/SELECT/i, 'SELECT TOP 200');
      }
      
      // Add this as the first attempt
      setRefinementAttempts([{
        attempt: 1,
        query: finalQuery
      }]);
      
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

      const responseData = await executeResponse.json();
      
      // Check if there are refined queries in the response
      if (responseData.refinements && responseData.refinements.length > 0) {
        // Update the refinement attempts with the new data
        const updatedAttempts = [...refinementAttempts];
        
        responseData.refinements.forEach((refinement: any, index: number) => {
          updatedAttempts.push({
            attempt: index + 2, // +2 because attempt 1 is the original query
            query: refinement.query,
            error: refinement.error
          });
        });
        
        setRefinementAttempts(updatedAttempts);
        
        // If there was a successful refinement, update the generated query
        if (responseData.refinements.length > 0 && responseData.results) {
          const lastRefinement = responseData.refinements[responseData.refinements.length - 1];
          setGeneratedQuery(lastRefinement.query);
        }
      }
      
      // Set the results if available
      if (responseData.results) {
        console.log("Query results:", responseData.results);
        setQueryResults(responseData.results);
        
        toast({
          title: "Query executed successfully",
          description: responseData.refinements && responseData.refinements.length > 0 
            ? `Required ${responseData.refinements.length} refinement attempts` 
            : undefined
        });
      }
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

      {queryError && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-red-700 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            Unable to Generate SQL Query
          </h3>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-800">{queryError}</p>
          </div>
        </div>
      )}

      {generatedQuery && !queryError && (
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

      {refinementAttempts.length > 1 && (
        <div className="mt-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" />
            Query Refinement History
          </h3>
          
          <div className="space-y-4">
            {refinementAttempts.map((attempt, index) => (
              <div key={index} className="border rounded-md p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">Attempt #{attempt.attempt}</span>
                  {attempt.error && (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      Failed
                    </span>
                  )}
                </div>
                
                <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
                  <code>{attempt.query}</code>
                </pre>
                
                {attempt.error && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                    <strong>Error:</strong> {attempt.error}
                  </div>
                )}
              </div>
            ))}
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
