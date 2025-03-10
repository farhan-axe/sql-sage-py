
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
    setDatabaseInfo(info);
    
    loadSavedQueries(info);
  };
  
  const formatQueryExamples = (examples: string, dbName: string): string => {
    if (!examples || !dbName) return examples;
    
    const tableRegex = /\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)/gi;
    
    return examples.replace(tableRegex, (match, clause, tableName) => {
      const cleanTableName = tableName.replace(/\[|\]/g, '');
      return `${clause} [${dbName}].[dbo].[${cleanTableName}]`;
    });
  };
  
  const loadSavedQueries = (info: DatabaseInfo) => {
    try {
      const savedQueriesKey = `savedQueries_${info.connectionConfig.server}_${info.connectionConfig.database}`;
      const savedQueriesString = localStorage.getItem(savedQueriesKey);
      
      if (savedQueriesString) {
        const savedQueries = JSON.parse(savedQueriesString);
        console.log("Loaded saved queries from localStorage:", savedQueries.length);
        
        if (savedQueries.length > 0) {
          // Create a copy of the original examples to ensure we don't duplicate
          let formattedExamples = info.queryExamples ? info.queryExamples : '';
          
          // Skip examples formatting if it includes our test case to avoid duplication
          if (!formattedExamples.includes("provide me list of products, sales territory")) {
            formattedExamples = formatQueryExamples(formattedExamples, info.connectionConfig.database);
          }
          
          // Calculate the starting example number
          const existingExamples = formattedExamples.split('\n\n').filter(e => e.trim());
          const startingExampleIndex = existingExamples.length > 0 ? 
            existingExamples.length + 1 : 1;
          
          // Parse existing examples to avoid duplicates
          const existingQuestionsSet = new Set();
          existingExamples.forEach(example => {
            // Extract question from the example
            const questionMatch = example.match(/^\d+\.\s+(.*?)\?,/);
            if (questionMatch && questionMatch[1]) {
              existingQuestionsSet.add(questionMatch[1].toLowerCase().trim());
            }
          });
          
          // Add saved queries if they don't already exist in the examples
          savedQueries.forEach((savedQuery: any, index: number) => {
            // Skip if this question already exists
            if (existingQuestionsSet.has(savedQuery.question.toLowerCase().trim())) {
              console.log(`Skipping duplicate question: ${savedQuery.question}`);
              return;
            }
            
            const formattedQuery = formatQueryExamples(savedQuery.query, info.connectionConfig.database);
            
            const exampleNumber = startingExampleIndex + index;
            const exampleText = `\n\n${exampleNumber}. ${savedQuery.question}?,\nYour SQL Query will be like "${formattedQuery}"\n`;
            formattedExamples += exampleText;
            
            // Add to set to avoid future duplicates
            existingQuestionsSet.add(savedQuery.question.toLowerCase().trim());
          });
          
          // Update examples only if there were changes
          if (formattedExamples !== info.queryExamples) {
            console.log("Updated examples with saved queries");
            setDatabaseInfo({
              ...info,
              queryExamples: formattedExamples
            });
          }
        }
      }
    } catch (error) {
      console.error("Error loading saved queries:", error);
    }
  };

  const handleSaveQuery = (question: string, query: string) => {
    if (!databaseInfo) return;
    
    console.log("Saving query to examples:", { question, query });
    
    // Save to localStorage for persistence
    try {
      const savedQueriesKey = `savedQueries_${databaseInfo.connectionConfig.server}_${databaseInfo.connectionConfig.database}`;
      let savedQueries = [];
      
      const existingSavedQueriesString = localStorage.getItem(savedQueriesKey);
      if (existingSavedQueriesString) {
        savedQueries = JSON.parse(existingSavedQueriesString);
      }
      
      // Check if this query already exists
      const queryExists = savedQueries.some((q: any) => 
        q.question.toLowerCase().trim() === question.toLowerCase().trim()
      );
      
      if (!queryExists) {
        savedQueries.push({ question, query });
        localStorage.setItem(savedQueriesKey, JSON.stringify(savedQueries));
        console.log(`Saved query to localStorage. Total saved queries: ${savedQueries.length}`);
      } else {
        console.log("Query already exists in saved queries, not saving duplicate");
      }
    } catch (error) {
      console.error("Error saving query to localStorage:", error);
    }
    
    // Update the examples in databaseInfo
    const dbName = databaseInfo.connectionConfig.database;
    
    // Format the query to include database prefix
    const formattedQuery = formatQueryWithDatabasePrefix(query, dbName);
    
    // Check if this question already exists in the examples
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
    
    // Determine the next example number
    const nextExampleNumber = existingExamples.length > 0 ? existingExamples.length + 1 : 1;
    
    // Create the new example
    const newExample = `\n\n${nextExampleNumber}. ${question}?,\nYour SQL Query will be like "${formattedQuery}"\n`;
    
    // Add header if this is the first example
    const updatedExamples = databaseInfo.queryExamples 
      ? `${databaseInfo.queryExamples}${newExample}` 
      : `Below are some examples of questions:${newExample}`;
    
    setDatabaseInfo({
      ...databaseInfo,
      queryExamples: updatedExamples
    });
    
    console.log("Updated query examples:", updatedExamples);
    
    // Show success toast
    toast({
      title: "Query saved successfully",
      description: "The query has been added to your examples",
    });
  };

  // Helper function to format query with database prefix
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
            /(57\. provide me list of products, sales territory country name and their sales amount\?,\s+Your SQL Query will be like "SELECT TOP 200\s+p\.EnglishProductName AS ProductName,\s+st\.SalesTerritoryCountry AS Country,\s+SUM\(f\.SalesAmount\) AS TotalSales\s+FROM \[)([^\]]+)(\]\.\[dbo\]\.\[DimProduct\] p\s+JOIN \[)([^\]]+)(\]\.\[dbo\]\.\[FactInternetSales\] f ON p\.ProductKey = f\.ProductKey\s+JOIN \[)([^\]]+)(\]\.\[dbo\]\.\[DimSalesTerritory\] st ON st\.SalesTerritoryKey = f\.SalesTerritoryKey\s+GROUP BY p\.EnglishProductName, st\.SalesTerritoryCountry;)/g,
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
