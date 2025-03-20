
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo } from "@/types/database";
import { RotateCcw, XCircle, Clock } from "lucide-react";
import { isNonSqlResponse } from "@/services/sqlServer";
import { searchSchema } from "@/services/sql/parser";

interface QueryFormProps {
  isConnected: boolean;
  databaseInfo: DatabaseInfo | null;
  onQueryGeneration: (query: string, time: number) => void;
  onTerminate: () => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  controller: AbortController | null;
  setController: (controller: AbortController | null) => void;
  sessionTimeout: NodeJS.Timeout | null;
  setSessionTimeout: (timeout: NodeJS.Timeout | null) => void;
  setQuestion: (question: string) => void;
}

const QueryForm = ({
  isConnected,
  databaseInfo,
  onQueryGeneration,
  onTerminate,
  isGenerating,
  setIsGenerating,
  controller,
  setController,
  sessionTimeout,
  setSessionTimeout,
  setQuestion
}: QueryFormProps) => {
  const { toast } = useToast();
  const [questionInput, setQuestionInput] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isGenerating) {
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
  }, [isGenerating]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const validateQuestion = (text: string): boolean => {
    if (!text.trim()) {
      toast({
        title: "Please enter a question",
        variant: "destructive",
      });
      return false;
    }
    
    if (isNonSqlResponse(text)) {
      console.log("Non-database question detected:", text);
      toast({
        title: "Non-database question detected",
        description: "Please ask a question related to your database content",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
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
    console.log("Extracting SQL from:", text.substring(0, 200) + "...");
    
    const queryFormatMatch = text.match(/Your SQL Query will be like "([\s\S]*?)"/i);
    if (queryFormatMatch) {
      const extracted = queryFormatMatch[1].trim();
      console.log("Extracted from 'Your SQL Query will be like' format:", extracted);
      return extracted;
    }
    
    const sqlBlockMatch = text.match(/```sql\s*([\s\S]*?)\s*```/i);
    if (sqlBlockMatch) {
      const extracted = sqlBlockMatch[1].trim();
      console.log("Extracted from SQL code block:", extracted);
      return extracted;
    }
    
    const sqlPattern = /\b(SELECT|WITH)\b[\s\S]*?(;|\n\s*\n|$)/i;
    const sqlMatch = text.match(sqlPattern);
    if (sqlMatch) {
      const extracted = sqlMatch[0].trim().replace(/;$/, '');
      console.log("Extracted using SQL pattern regex:", extracted);
      
      const cleanedQuery = extracted.split('\n')
        .filter(line => {
          const trimmedLine = line.trim().toLowerCase();
          return trimmedLine !== '' && 
                !trimmedLine.includes('here is') && 
                !trimmedLine.includes('query:') && 
                !trimmedLine.includes('sql query:');
        })
        .join('\n')
        .trim();
      
      console.log("Cleaned extracted query:", cleanedQuery);
      return cleanedQuery;
    }
    
    const sqlKeywordsStart = ['SELECT', 'WITH'];
    const lines = text.split('\n');
    let queryLines = [];
    let inQuery = false;
    let bracketBalance = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      const upperLine = trimmedLine.toUpperCase();
      
      if (!inQuery && sqlKeywordsStart.some(keyword => upperLine.startsWith(keyword))) {
        inQuery = true;
      }
      
      if (inQuery) {
        bracketBalance += (trimmedLine.match(/\(/g) || []).length;
        bracketBalance -= (trimmedLine.match(/\)/g) || []).length;
        
        if (trimmedLine !== '' && 
            !trimmedLine.toLowerCase().includes('here') &&
            !trimmedLine.toLowerCase().includes('query:') &&
            !trimmedLine.toLowerCase().includes('sql query:')) {
          queryLines.push(line);
        }
        
        if (trimmedLine.endsWith(';') || 
            (bracketBalance <= 0 && (
              lines.indexOf(line) === lines.length - 1 || 
              (lines.indexOf(line) + 1 < lines.length && lines[lines.indexOf(line) + 1].trim() === '')
            ))) {
          break;
        }
      }
    }
    
    const result = queryLines.join('\n').trim();
    console.log("Fallback extraction result:", result);
    return result;
  };

  const formatQueryWithDatabasePrefix = (query: string): string => {
    if (!databaseInfo || !databaseInfo.connectionConfig || !databaseInfo.connectionConfig.database) {
      return query;
    }

    const dbName = databaseInfo.connectionConfig.database;
    
    const tableRegex = /\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)/gi;
    
    return query.replace(tableRegex, (match, clause, tableName) => {
      const cleanTableName = tableName.replace(/\[|\]/g, '');
      return `${clause} [${dbName}].[dbo].[${cleanTableName}]`;
    });
  };

  const handleQueryGeneration = async () => {
    if (!questionInput.trim() || !databaseInfo) {
      toast({
        title: "Please enter a question and ensure database is connected",
        variant: "destructive",
      });
      return;
    }

    if (!validateQuestion(questionInput)) {
      return;
    }

    setQuestion(questionInput);
    setIsGenerating(true);

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
    const startTime = Date.now(); // Track when we start generating
    
    try {
      console.log("Starting query generation...");
      
      // Try to get relevant schema parts from vector search if available
      let relevantSchema = "";
      try {
        console.log("Attempting to retrieve relevant schema for:", questionInput);
        relevantSchema = await searchSchema(questionInput);
        console.log("Retrieved relevant schema:", relevantSchema ? "Success" : "Empty result");
      } catch (error) {
        console.log("Vector search not available, proceeding with standard query generation:", error);
        // Continue with normal query generation if vector search fails
      }
      
      const generateResponse = await fetchWithTimeout(
        'http://localhost:3001/api/sql/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: questionInput,
            databaseInfo: {
              ...databaseInfo,
              // If we got relevant schema from vector search, add it to the request
              ...(relevantSchema && { relevantSchema })
            },
            maxRows: 200,
            promptTemplate: databaseInfo.promptTemplate,
            queryExamples: databaseInfo.queryExamples
          }),
        },
        newController
      );

      const generatedData = await generateResponse.json();
      const endTime = Date.now(); // Track when we finish generating
      const timeElapsed = endTime - startTime;
      
      console.log("Generated response from backend:", generatedData.query);
      console.log(`Query generation took ${timeElapsed}ms`);
      
      if (isNonSqlResponse(generatedData.query)) {
        console.log("Detected non-SQL response, displaying as error message");
        toast({
          title: "Cannot generate SQL query",
          description: "The database does not contain the requested information",
          variant: "destructive",
        });
        onQueryGeneration("", 0);
        return;
      }
      
      const extractedQuery = extractSQLQuery(generatedData.query);
      console.log("Extracted SQL query:", extractedQuery);
      
      if (!extractedQuery) {
        throw new Error('Failed to extract a valid SQL query from the response');
      }
      
      let finalQuery = extractedQuery;
      if (finalQuery.toUpperCase().trim().startsWith('SELECT') && 
          !finalQuery.toUpperCase().includes('TOP ')) {
        finalQuery = finalQuery.replace(/\bSELECT\b\s+/i, 'SELECT TOP 200 ');
      }
      
      console.log("Final query after TOP 200 injection (if needed):", finalQuery);
      
      const formattedQuery = formatQueryWithDatabasePrefix(finalQuery);
      console.log("Formatted query with database prefix:", formattedQuery);
      
      onQueryGeneration(formattedQuery, timeElapsed);
      
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
      onQueryGeneration("", 0);
    } finally {
      setIsGenerating(false);
      setController(null);
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        setSessionTimeout(null);
      }
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="question" className="text-sm font-medium text-gray-700">
        Ask a question about your data
      </label>
      <Textarea
        id="question"
        value={questionInput}
        onChange={(e) => setQuestionInput(e.target.value)}
        placeholder="e.g., Show me the sales from last year"
        className="h-24"
      />
      <div className="flex gap-2">
        <Button 
          onClick={handleQueryGeneration}
          disabled={isGenerating || !questionInput.trim() || !isConnected}
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
        
        {isGenerating && (
          <>
            <Button 
              onClick={onTerminate}
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
  );
};

export default QueryForm;
