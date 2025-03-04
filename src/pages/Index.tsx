
import { useState } from "react";
import DatabaseConnection from "@/components/DatabaseConnection";
import QueryInterface from "@/components/QueryInterface";
import { DatabaseInfo } from "@/types/database";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const handleSessionTermination = (success: boolean) => {
    if (success) {
      toast({
        title: "Session terminated",
        description: "The database session has been successfully terminated.",
        variant: "default",
      });
    } else {
      toast({
        title: "Session termination failed",
        description: "Failed to terminate the database session. The operation may still be running on the server.",
        variant: "destructive",
      });
    }
  };

  const EmptyStateContent = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
      <p className="text-gray-500">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-blue-50 p-6 shadow-lg overflow-auto">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Database Connection</h2>
        <DatabaseConnection 
          onConnect={(info) => {
            setIsConnected(true);
            setDatabaseInfo(info);
          }}
          isParsing={isParsing}
          setIsParsing={setIsParsing}
        />

        {isConnected && (
          <div className="mt-6">
            <Tabs defaultValue="schema" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="schema">Schema</TabsTrigger>
                <TabsTrigger value="examples">Examples</TabsTrigger>
              </TabsList>
              <TabsContent value="schema" className="mt-2">
                <ScrollArea className="h-[300px] rounded-md border p-4 bg-white">
                  {databaseInfo?.promptTemplate ? (
                    <pre className="text-xs whitespace-pre-wrap">{databaseInfo.promptTemplate}</pre>
                  ) : (
                    <EmptyStateContent message="Database schema will appear here after parsing. If schema is empty, the database might not have any tables or there was an error during parsing." />
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="examples" className="mt-2">
                <ScrollArea className="h-[300px] rounded-md border p-4 bg-white">
                  {databaseInfo?.queryExamples ? (
                    <pre className="text-xs markdown-content whitespace-pre-wrap">{databaseInfo.queryExamples}</pre>
                  ) : (
                    <EmptyStateContent message="Query examples will appear here after parsing. Examples help you understand how to query the database." />
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <QueryInterface 
          isConnected={isConnected}
          databaseInfo={databaseInfo}
          onSessionTerminate={handleSessionTermination}
        />
      </div>
    </div>
  );
};

export default Index;
