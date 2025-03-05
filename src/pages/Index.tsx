
import { useState, useEffect } from "react";
import DatabaseConnection from "@/components/DatabaseConnection";
import QueryInterface from "@/components/QueryInterface";
import { DatabaseInfo } from "@/types/database";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, DatabaseIcon, AlertTriangle } from "lucide-react";
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

  const handleDatabaseConnect = (info: DatabaseInfo) => {
    console.log("Database connected with info:", {
      tablesCount: info.tables?.length || 0,
      hasPromptTemplate: !!info.promptTemplate,
      promptTemplateLength: info.promptTemplate?.length || 0,
      hasQueryExamples: !!info.queryExamples,
      queryExamplesLength: info.queryExamples?.length || 0
    });
    
    setIsConnected(true);
    setDatabaseInfo(info);
  };

  const handleSaveQuery = (question: string, query: string) => {
    if (!databaseInfo) return;
    
    const newExample = `\n\n${databaseInfo.queryExamples.length > 0 ? '' : 'Below are some examples of questions:\n\n'}${databaseInfo.queryExamples.includes('1.') ? (
      `${databaseInfo.queryExamples.split('\n\n').filter(e => e.trim()).length + 1}. ${question}?,\nYour SQL Query will be like "${query}"\n`
    ) : (
      `1. ${question}?,\nYour SQL Query will be like "${query}"\n`
    )}`;
    
    const updatedExamples = databaseInfo.queryExamples 
      ? `${databaseInfo.queryExamples}${newExample}` 
      : newExample;
    
    setDatabaseInfo({
      ...databaseInfo,
      queryExamples: updatedExamples
    });
    
    console.log("Updated query examples:", updatedExamples);
  };

  const EmptyStateContent = ({ message, icon = <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />, warning = false }: { 
    message: string;
    icon?: React.ReactNode;
    warning?: boolean;
  }) => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      {icon}
      <p className={cn("text-gray-500", warning && "text-amber-600")}>{message}</p>
    </div>
  );

  const isSchemaEmpty = !databaseInfo?.promptTemplate || 
    databaseInfo.promptTemplate.includes("No tables found") ||
    databaseInfo.promptTemplate.includes("No schema information");

  const areExamplesEmpty = !databaseInfo?.queryExamples || 
    databaseInfo.queryExamples.includes("No tables available") ||
    databaseInfo.queryExamples.includes("Could not generate examples");

  useEffect(() => {
    if (databaseInfo && databaseInfo.queryExamples && !databaseInfo.queryExamples.includes("provide me list of products, sales territory")) {
      const productSalesExample = `
      
${databaseInfo.queryExamples.split('\n\n').filter(e => e.trim()).length + 1}. provide me list of products, sales territory country name and their sales amount?,
Your SQL Query will be like "SELECT TOP 200 
    p.EnglishProductName AS ProductName,
    st.SalesTerritoryCountry AS Country,
    SUM(f.SalesAmount) AS TotalSales
FROM DimProduct p
JOIN FactInternetSales f ON p.ProductKey = f.ProductKey
JOIN DimSalesTerritory st ON st.SalesTerritoryKey = f.SalesTerritoryKey
GROUP BY p.EnglishProductName, st.SalesTerritoryCountry;"
`;
      
      setDatabaseInfo({
        ...databaseInfo,
        queryExamples: databaseInfo.queryExamples + productSalesExample
      });
    }
  }, [databaseInfo]);

  return (
    <div className="min-h-screen flex">
      <div className="w-80 bg-blue-50 p-6 shadow-lg overflow-auto">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Database Connection</h2>
        <DatabaseConnection 
          onConnect={handleDatabaseConnect}
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
                    <>
                      {isSchemaEmpty && (
                        <Alert variant="destructive" className="mb-4 bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertTitle>No Database Schema Found</AlertTitle>
                          <AlertDescription className="text-sm">
                            The selected database appears to be empty or you may not have permission to access its tables.
                          </AlertDescription>
                        </Alert>
                      )}
                      <pre className="text-xs whitespace-pre-wrap">{databaseInfo.promptTemplate}</pre>
                    </>
                  ) : (
                    <EmptyStateContent 
                      icon={<DatabaseIcon className="h-12 w-12 text-gray-400 mb-4" />}
                      message="Database schema will appear here after parsing. If schema is empty, the database might not have any tables or there was an error during parsing." 
                    />
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="examples" className="mt-2">
                <ScrollArea className="h-[300px] rounded-md border p-4 bg-white">
                  {databaseInfo?.queryExamples ? (
                    <>
                      {areExamplesEmpty && (
                        <Alert variant="destructive" className="mb-4 bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertTitle>No Query Examples Available</AlertTitle>
                          <AlertDescription className="text-sm">
                            Cannot generate examples for an empty database. Try selecting a database with tables.
                          </AlertDescription>
                        </Alert>
                      )}
                      <pre className="text-xs markdown-content whitespace-pre-wrap">{databaseInfo.queryExamples}</pre>
                    </>
                  ) : (
                    <EmptyStateContent 
                      message="Query examples will appear here after parsing. Examples help you understand how to query the database." 
                    />
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <div className="flex-1 p-6">
        <QueryInterface 
          isConnected={isConnected}
          databaseInfo={databaseInfo}
          onSessionTerminate={handleSessionTermination}
          onSaveQuery={handleSaveQuery}
        />
      </div>
    </div>
  );
};

export default Index;
