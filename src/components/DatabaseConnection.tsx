
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { connectToServer, parseDatabase } from "@/services/sqlServer";
import type { DatabaseInfo, ConnectionConfig } from "@/types/database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, InfoIcon, CheckCircle2, Loader2, DatabaseIcon, X, Check, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DatabaseConnectionProps {
  onConnect: (info: DatabaseInfo) => void;
  isParsing: boolean;
  setIsParsing: (isParsing: boolean) => void;
}

interface DatabaseSelection {
  database: string;
  parsed: boolean;
  selected: boolean;
}

const DatabaseConnection = ({ onConnect, isParsing, setIsParsing }: DatabaseConnectionProps) => {
  const { toast } = useToast();
  const [server, setServer] = useState("");
  const [authType, setAuthType] = useState("windows"); // "windows" or "sql"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedDbs, setSelectedDbs] = useState<DatabaseSelection[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    setConnectionSuccess(false);
    try {
      console.log("Starting connection with:", {
        server,
        authType,
        username: authType === "sql" ? username : undefined
      });
      
      const dbs = await connectToServer({
        server,
        useWindowsAuth: authType === "windows",
        ...(authType === "sql" && { username, password }),
      });
      
      setDatabases(dbs);
      setSelectedDbs([]);
      setConnectionSuccess(true);
      toast({
        title: "Connected successfully",
        description: "You can now select databases to parse",
      });
    } catch (error) {
      console.error('Connection error details:', error);
      setConnectionError(error instanceof Error ? error.message : 'Unknown connection error');
      toast({
        title: "Connection failed",
        description: "Please ensure the backend server is running on http://localhost:3001",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleDatabaseSelection = (dbName: string) => {
    setSelectedDbs(prevDbs => {
      const existingDb = prevDbs.find(db => db.database === dbName);
      
      if (existingDb) {
        // If already in list, toggle selection
        return prevDbs.map(db => 
          db.database === dbName ? { ...db, selected: !db.selected } : db
        );
      } else {
        // If not in list, add it as selected
        return [...prevDbs, { database: dbName, parsed: false, selected: true }];
      }
    });
  };

  const toggleSelectAll = () => {
    // Check if all databases are already selected
    const allSelected = databases.every(db => 
      selectedDbs.some(selected => selected.database === db && selected.selected)
    );
    
    if (allSelected) {
      // Deselect all
      setSelectedDbs(prevDbs => prevDbs.map(db => ({ ...db, selected: false })));
    } else {
      // Select all
      const currentDbs = [...selectedDbs];
      const allDbs = databases.map(db => {
        const existing = currentDbs.find(d => d.database === db);
        return existing 
          ? { ...existing, selected: true }
          : { database: db, parsed: false, selected: true };
      });
      
      setSelectedDbs(allDbs);
    }
  };

  const removeDatabase = (dbName: string) => {
    setSelectedDbs(selectedDbs.filter(db => db.database !== dbName));
  };

  const handleParseDatabase = async (dbName: string) => {
    setIsParsing(true);
    setParseError(null);
    try {
      console.log(`Starting database parsing for ${dbName} on ${server}`);
      
      const parseResult = await parseDatabase(
        server,
        dbName,
        authType === "windows",
        authType === "sql" ? { username, password } : undefined
      );
      
      console.log("Parse result received:", {
        tablesCount: parseResult.schema?.length || 0,
        hasPromptTemplate: !!parseResult.promptTemplate,
        promptTemplateLength: parseResult.promptTemplate?.length || 0,
        hasQueryExamples: !!parseResult.queryExamples,
        queryExamplesLength: parseResult.queryExamples?.length || 0
      });

      // Mark this database as parsed
      setSelectedDbs(prev => prev.map(db => 
        db.database === dbName ? { ...db, parsed: true } : db
      ));

      if (!parseResult.schema || parseResult.schema.length === 0) {
        setParseError("No tables found in the database. The schema might be empty or not accessible.");
        onConnect({
          tables: [],
          promptTemplate: parseResult.promptTemplate || "No database schema available.",
          queryExamples: parseResult.queryExamples || "No query examples available.",
          connectionConfig: parseResult.connectionConfig
        });
        
        toast({
          title: "Empty database schema",
          description: "No tables were found in the selected database.",
          variant: "destructive",
        });
      } else {
        onConnect(parseResult);
        toast({
          title: "Database parsed successfully",
          description: `Found ${parseResult.schema.length} tables in the database.`,
        });
      }
    } catch (error) {
      console.error('Parsing error details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      setParseError(errorMessage);
      toast({
        title: "Parsing failed",
        description: "Error parsing database schema",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const allSelected = databases.length > 0 && 
    databases.every(db => selectedDbs.some(selected => selected.database === db && selected.selected));

  const selectedCount = selectedDbs.filter(db => db.selected).length;

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <InfoIcon className="h-4 w-4 text-blue-600" />
        <AlertTitle>Backend Required</AlertTitle>
        <AlertDescription className="text-sm">
          Make sure your backend server is running on http://localhost:3001 
          before connecting. No connection requests will work without the backend server.
        </AlertDescription>
      </Alert>

      {connectionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>
            {connectionError}
            {connectionError.includes('HTML instead of JSON') && (
              <div className="mt-2 text-sm">
                <p>Make sure your backend server is running at http://localhost:3001</p>
                <p className="mt-1">The connection URL is: http://localhost:3001/api/sql/connect</p>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database parsing failed</AlertTitle>
          <AlertDescription>
            {parseError}
          </AlertDescription>
        </Alert>
      )}

      {connectionSuccess && !databases.length && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Connection Successful</AlertTitle>
          <AlertDescription className="text-sm">
            Loading available databases...
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="server">Server</Label>
        <Input
          id="server"
          value={server}
          onChange={(e) => setServer(e.target.value)}
          placeholder="e.g., localhost"
        />
      </div>

      <div className="space-y-2">
        <Label>Authentication Type</Label>
        <RadioGroup
          value={authType}
          onValueChange={setAuthType}
          className="grid grid-cols-1 gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="windows" id="windows" />
            <Label htmlFor="windows">Windows Authentication</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sql" id="sql" />
            <Label htmlFor="sql">SQL Server Authentication</Label>
          </div>
        </RadioGroup>
      </div>

      {authType === "sql" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </>
      )}

      <Button 
        onClick={handleConnect}
        disabled={!server || (authType === "sql" && (!username || !password)) || isConnecting}
        className="w-full"
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : "Connect"}
      </Button>

      {databases.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Databases to Parse</Label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleSelectAll}
                className="text-xs h-8"
              >
                <ListChecks className="h-3.5 w-3.5 mr-1" />
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            <Card className="border rounded-md">
              <CardContent className="p-0">
                <ScrollArea className="h-[220px] py-2">
                  <div className="px-2 py-1">
                    {databases.map((db) => {
                      const dbSelection = selectedDbs.find(selection => selection.database === db);
                      const isSelected = dbSelection?.selected ?? false;
                      const isParsed = dbSelection?.parsed ?? false;
                      
                      return (
                        <div key={db} className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id={`db-${db}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleDatabaseSelection(db)}
                            />
                            <Label htmlFor={`db-${db}`} className="cursor-pointer flex items-center gap-2">
                              <DatabaseIcon className="h-4 w-4 text-gray-500" />
                              <span>{db}</span>
                              {isParsed && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs ml-1">
                                  Parsed
                                </Badge>
                              )}
                            </Label>
                          </div>
                          {isSelected && !isParsed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleParseDatabase(db)}
                              disabled={isParsing}
                              className="h-7 text-xs"
                            >
                              {isParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Parse"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            {selectedCount > 0 && (
              <div className="text-sm text-gray-500">
                {selectedCount} database{selectedCount !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseConnection;
