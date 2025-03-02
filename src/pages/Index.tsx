
import { useState } from "react";
import DatabaseConnection from "@/components/DatabaseConnection";
import QueryInterface from "@/components/QueryInterface";
import { DatabaseInfo } from "@/types/database";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-blue-50 p-6 shadow-lg">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Database Connection</h2>
        <DatabaseConnection 
          onConnect={(info) => {
            setIsConnected(true);
            setDatabaseInfo(info);
          }}
          isParsing={isParsing}
          setIsParsing={setIsParsing}
        />
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
