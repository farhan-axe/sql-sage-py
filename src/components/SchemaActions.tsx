
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseInfo } from "@/types/database";
import { embedSchema } from "@/services/sql/parser";
import { Database, Server, Vector } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SchemaActionsProps {
  databaseInfo: DatabaseInfo | null;
  isConnected: boolean;
}

const SchemaActions = ({ databaseInfo, isConnected }: SchemaActionsProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateVectorDb = async () => {
    if (!databaseInfo || !databaseInfo.tables || databaseInfo.tables.length === 0) {
      toast({
        title: "No schema available",
        description: "Please connect to a database with tables first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
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
      setIsLoading(false);
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
              disabled={!isConnected || isLoading || !databaseInfo?.tables.length}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Vector className="h-4 w-4 animate-pulse" />
                  Creating...
                </>
              ) : (
                <>
                  <Vector className="h-4 w-4" />
                  Create Vector Database
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create vector embeddings for schema to improve query generation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default SchemaActions;
