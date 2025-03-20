
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo } from "@/types/database";
import { embedSchema, embedExamples } from "@/services/sql/parser";
import { Database, BookOpen, Braces } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SchemaActionsProps {
  databaseInfo: DatabaseInfo | null;
  isConnected: boolean;
}

const SchemaActions = ({ databaseInfo, isConnected }: SchemaActionsProps) => {
  const { toast } = useToast();
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);

  const handleCreateVectorDb = async () => {
    if (!databaseInfo || !databaseInfo.tables || databaseInfo.tables.length === 0) {
      toast({
        title: "No schema available",
        description: "Please connect to a database with tables first",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingSchema(true);
    try {
      const result = await embedSchema(databaseInfo);
      
      if (result.success) {
        toast({
          title: "Vector database created",
          description: result.message,
        });
      } else {
        toast({
          title: "Error creating vector database",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating vector database:", error);
      toast({
        title: "Error creating vector database",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const handleEmbedExamples = async () => {
    if (!databaseInfo || !databaseInfo.queryExamples) {
      toast({
        title: "No query examples available",
        description: "Please connect to a database with examples first",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingExamples(true);
    try {
      const result = await embedExamples(databaseInfo);
      
      if (result.success) {
        toast({
          title: "Query examples embedded",
          description: result.message,
        });
      } else {
        toast({
          title: "Error embedding examples",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error embedding query examples:", error);
      toast({
        title: "Error embedding examples",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingExamples(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 mt-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleCreateVectorDb}
              disabled={!isConnected || isLoadingSchema || !databaseInfo?.tables.length}
              className="flex items-center gap-2"
            >
              {isLoadingSchema ? (
                <>
                  <Braces className="h-4 w-4 animate-pulse" />
                  Creating...
                </>
              ) : (
                <>
                  <Braces className="h-4 w-4" />
                  Create Schema Vector
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create vector embeddings for schema to improve query generation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleEmbedExamples}
              disabled={!isConnected || isLoadingExamples || !databaseInfo?.queryExamples}
              className="flex items-center gap-2"
            >
              {isLoadingExamples ? (
                <>
                  <BookOpen className="h-4 w-4 animate-pulse" />
                  Creating...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4" />
                  Create Examples Vector
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create vector embeddings for query examples to improve query generation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default SchemaActions;
