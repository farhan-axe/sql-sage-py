
import { useState, useEffect, useRef } from "react";
import { DatabaseInfo, QueryRefinementAttempt } from "@/types/database";
import { useToast } from "@/components/ui/use-toast";
import { terminateSession } from "@/services/sqlServer";
import QueryForm from "./query/QueryForm";
import QueryDisplay from "./query/QueryDisplay";
import ResultsDisplay from "./query/ResultsDisplay";
import ErrorDisplay from "./query/ErrorDisplay";
import { formatQueryWithDatabasePrefix } from "@/utils/queryUtils";

const QueryInterface = ({ 
  isConnected, 
  databaseInfo, 
  onSessionTerminate, 
  onSaveQuery, 
  onQueryGenerated 
}: {
  isConnected: boolean;
  databaseInfo: DatabaseInfo | null;
  onSessionTerminate: (success: boolean) => void;
  onSaveQuery?: (question: string, query: string) => void;
  onQueryGenerated?: (timeInMs: number) => void;
}) => {
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
  const [queryGenerationTime, setQueryGenerationTime] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (isExecuting) {
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
  }, [isExecuting]);

  const handleQueryGeneration = (query: string, time: number) => {
    setGeneratedQuery(query);
    setQueryResults(null);
    setQueryError(query ? null : "Unable to generate a valid SQL query for this question.");
    
    if (time > 0) {
      setQueryGenerationTime(time);
      if (onQueryGenerated) {
        onQueryGenerated(time);
      }
    }
    
    if (query) {
      setRefinementAttempts([{
        attempt: 1,
        query
      }]);
    } else {
      setRefinementAttempts([]);
    }
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
      
      if (responseData.refinements && responseData.refinements.length > 0) {
        const updatedAttempts = [...refinementAttempts];
        
        responseData.refinements.forEach((refinement: any, index: number) => {
          updatedAttempts.push({
            attempt: index + 2,
            query: refinement.query,
            error: refinement.error
          });
        });
        
        setRefinementAttempts(updatedAttempts);
        
        if (responseData.refinements.length > 0 && responseData.results) {
          const lastRefinement = responseData.refinements[responseData.refinements.length - 1];
          setGeneratedQuery(lastRefinement.query);
        }
      }
      
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
          onSessionTerminate(true);
        }
      }
    }
  };

  const handleSaveQuery = () => {
    if (!question || !generatedQuery || !onSaveQuery || !databaseInfo) return;
    
    const formattedQuery = formatQueryWithDatabasePrefix(
      generatedQuery, 
      databaseInfo.connectionConfig.database
    );
    
    onSaveQuery(question, formattedQuery);
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
      <QueryForm
        isConnected={isConnected}
        databaseInfo={databaseInfo}
        onQueryGeneration={handleQueryGeneration}
        onTerminate={terminateOperation}
        isGenerating={isGenerating}
        setIsGenerating={setIsGenerating}
        controller={controller}
        setController={setController}
        sessionTimeout={sessionTimeout}
        setSessionTimeout={setSessionTimeout}
      />

      <ErrorDisplay error={queryError || ""} />

      {generatedQuery && !queryError && (
        <QueryDisplay
          query={generatedQuery}
          databaseInfo={databaseInfo}
          isExecuting={isExecuting}
          isGenerating={isGenerating}
          onExecute={handleQueryExecution}
          onSave={handleSaveQuery}
          onTerminate={terminateOperation}
          elapsedTime={elapsedTime}
          queryGenerationTime={queryGenerationTime}
          refinementAttempts={refinementAttempts}
          question={question}
        />
      )}

      <ResultsDisplay results={queryResults} />
    </div>
  );
};

export default QueryInterface;
