import { useState, useEffect } from "react";
import DatabaseConnection from "@/components/DatabaseConnection";
import QueryInterface from "@/components/QueryInterface";
import { DatabaseInfo } from "@/types/database";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, DatabaseIcon, AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadQueriesFromLocalStorage, updateQueryExamplesWithSavedQueries } from "@/utils/queryUtils";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [queryGenerationTime, setQueryGenerationTime] = useState<number | null>(null);
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
    
    const savedQueries = loadQueriesFromLocalStorage(
      info.connectionConfig.server, 
      info.connectionConfig.database
    );
    
    if (savedQueries && savedQueries.length > 0) {
      console.log(`Loaded ${savedQueries.length} saved queries from localStorage`);
      
      const updatedExamples = updateQueryExamplesWithSavedQueries(
        info.queryExamples,
        info.connectionConfig.database,
        savedQueries
      );
      
      if (updatedExamples !== info.queryExamples) {
        setDatabaseInfo({
          ...info,
          queryExamples: updatedExamples
        });
      } else {
        setDatabaseInfo(info);
      }
    } else {
      setDatabaseInfo(info);
    }
  };

  const handleSaveQuery = (question: string, query: string) => {
    if (!question || !query || !databaseInfo) {
      console.log("Cannot save query - missing required data:", {
        hasQuestion: Boolean(question),
        hasQuery: Boolean(query),
        hasDatabaseInfo: Boolean(databaseInfo)
      });
      return;
    }
    
    const server = databaseInfo.connectionConfig.server;
    const database = databaseInfo.connectionConfig.database;
    const saved = saveQueryToLocalStorage(server, database, question, query);
    
    if (!saved) {
      toast({
        title: "Query already saved",
        description: "This query is already in your examples",
      });
      return;
    }
    
    const dbName = databaseInfo.connectionConfig.database;
    
    const formattedQuery = formatQueryWithDatabasePrefix(query, dbName);
    
    const existingExamples = databaseInfo.queryExamples.split('\n\n').filter(e => e.trim());
    const questionExists = existingExamples.some(example => {
      const questionMatch = example.match(/^\d+\.\s+(.*?)\?,/);
      return questionMatch && 
        questionMatch[1].toLowerCase().trim() === question.toLowerCase().trim();
    });
    
    if (questionExists) {
      console.log("Question already exists in examples, not adding duplicate");
      toast({
        title: "Query already saved",
        description: "This query is already in your examples",
      });
      return;
    }
    
    const nextExampleNumber = existingExamples.length > 0 ? existingExamples.length + 1 : 1;
    
    const newExample = `\n\n${nextExampleNumber}. ${question}?,\nYour SQL Query will be like "${formattedQuery}"\n`;
    
    const updatedExamples = databaseInfo.queryExamples 
      ? `${databaseInfo.queryExamples}${newExample}` 
      : `Below are some examples of questions:${newExample}`;
    
    setDatabaseInfo({
      ...databaseInfo,
      queryExamples: updatedExamples
    });
    
    console.log("Updated query examples:", updatedExamples);
    
    toast({
      title: "Query saved successfully",
      description: "The query has been added to your examples",
    });
  };

  const formatQueryWithDatabasePrefix = (query: string, dbName: string): string => {
    if (!query || !dbName) return query;
    
    const tableRegex = /\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)/gi;
    
    return query.replace(tableRegex, (match, clause, tableName) => {
      const cleanTableName = tableName.replace(/\[|\]/g, '');
      return `${clause} [${dbName}].[dbo].[${cleanTableName}]`;
    });
  };

  const handleQueryGenerated = (timeInMs: number) => {
    console.log(`Setting query generation time: ${timeInMs}ms`);
    setQueryGenerationTime(timeInMs);
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
    if (databaseInfo && databaseInfo.connectionConfig && databaseInfo.connectionConfig.database) {
      const dbName = databaseInfo.connectionConfig.database;
      
      if (databaseInfo.queryExamples) {
        if (databaseInfo.queryExamples.includes("57. provide me list of products, sales territory country name and their sales amount?")) {
          const updatedExamples = databaseInfo.queryExamples.replace(
            /(57\. provide me list of products, sales territory country name and their sales amount\?,\s+Your SQL Query will be like "SELECT TOP 200\s+p\.EnglishProductName AS ProductName,\s+st\.SalesTerritoryCountry AS Country,\s+SUM\(f\.SalesAmount\) AS TotalSales\s+FROM \[)([^\]]+)(\]\.\[dbo\]\.\[DimProduct\] p\s+JOIN \[)([^\]]+)(\]\.\[dbo\]\.\[FactInternetSales\] f ON p\.ProductKey = f.ProductKey\s+JOIN \[)([^\]]+)(\]\.\[dbo\]\.\[DimSalesTerritory\] st ON st\.SalesTerritoryKey = f\.SalesTerritoryKey\s+GROUP BY p\.EnglishProductName, st\.SalesTerritoryCountry;)/g,
            (match, prefix, db1, middle1, db2, middle2, db3, suffix) => {
              return `${prefix}AdventureWorksDW2017${middle1}AdventureWorksDW2017${middle2}AdventureWorksDW2017${suffix}`;
            }
          );
          
          if (updatedExamples !== databaseInfo.queryExamples) {
            console.log("Updated question 57 with database name: AdventureWorksDW2017");
            setDatabaseInfo({
              ...databaseInfo,
              queryExamples: updatedExamples
            });
          }
        } else if (!databaseInfo.queryExamples.includes("provide me list of products, sales territory")) {
          const productSalesExample = `
      
57. provide me list of products, sales territory country name and their sales amount?,
Your SQL Query will be like "SELECT TOP 200 
    p.EnglishProductName AS ProductName,
    st.SalesTerritoryCountry AS Country,
    SUM(f.SalesAmount) AS TotalSales
FROM [AdventureWorksDW2017].[dbo].[DimProduct] p
JOIN [AdventureWorksDW2017].[dbo].[FactInternetSales] f ON p.ProductKey = f.ProductKey
JOIN [AdventureWorksDW2017].[dbo].[DimSalesTerritory] st ON st.SalesTerritoryKey = f.SalesTerritoryKey
GROUP BY p.EnglishProductName, st.SalesTerritoryCountry;"
`;
          
          setDatabaseInfo({
            ...databaseInfo,
            queryExamples: databaseInfo.queryExamples + productSalesExample
          });
        }
      }
    }
  }, [databaseInfo?.connectionConfig?.database]);

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

        {queryGenerationTime !== null && (
          <div className="mt-4">
            <Alert className="bg-blue-50 border-blue-200">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertTitle>Query Generation Time</AlertTitle>
              <AlertDescription className="text-sm">
                {queryGenerationTime < 1000 
                  ? `${queryGenerationTime}ms` 
                  : `${(queryGenerationTime / 1000).toFixed(2)}s`}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      <div className="flex-1 p-6">
        <QueryInterface 
          isConnected={isConnected}
          databaseInfo={databaseInfo}
          onSessionTerminate={handleSessionTermination}
          onSaveQuery={handleSaveQuery}
          onQueryGenerated={handleQueryGenerated}
        />
      </div>
    </div>
  );
};

export default Index;
