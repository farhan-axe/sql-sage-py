
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo, QueryRefinementAttempt } from "@/types/database";
import { RotateCcw, PlayCircle, XCircle, Clock, Save } from "lucide-react";
import { formatQueryWithDatabasePrefix } from "@/utils/queryUtils";

interface QueryDisplayProps {
  query: string;
  databaseInfo: DatabaseInfo | null;
  isExecuting: boolean;
  isGenerating: boolean;
  onExecute: () => void;
  onSave: () => void;
  onTerminate: () => void;
  elapsedTime: number;
  queryGenerationTime: number | null;
  refinementAttempts: QueryRefinementAttempt[];
  question: string;
}

const QueryDisplay = ({
  query,
  databaseInfo,
  isExecuting,
  isGenerating,
  onExecute,
  onSave,
  onTerminate,
  elapsedTime,
  queryGenerationTime,
  refinementAttempts,
  question
}: QueryDisplayProps) => {
  const { toast } = useToast();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatGenerationTime = (ms: number | null) => {
    if (ms === null) return "";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  const handleSaveQuery = () => {
    if (!question || !query || !databaseInfo) return;
    onSave();
    toast({
      title: "Query saved",
      description: "The query has been saved as an example",
    });
  };

  if (!query) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Generated SQL Query</h3>
        {queryGenerationTime !== null && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-500">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Generated in {formatGenerationTime(queryGenerationTime)}</span>
          </div>
        )}
      </div>
      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
        <code className="text-sm">{query}</code>
      </pre>
      <div className="flex gap-2">
        <Button 
          onClick={onExecute}
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
        
        <Button
          onClick={handleSaveQuery}
          disabled={isExecuting || isGenerating || !query}
          variant="outline"
          className="items-center justify-center gap-2"
          title="Save as example query"
        >
          <Save size={16} />
          Save Query
        </Button>
        
        {isExecuting && (
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

      {refinementAttempts.length > 1 && (
        <div className="mt-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
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
    </div>
  );
};

export default QueryDisplay;
