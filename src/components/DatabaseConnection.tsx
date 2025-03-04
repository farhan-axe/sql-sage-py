
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { connectToServer, parseDatabase } from "@/services/sqlServer";
import type { DatabaseInfo, ConnectionConfig } from "@/types/database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, InfoIcon, CheckCircle2, Loader2, DatabaseIcon, PlusCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DatabaseConnectionProps {
  onConnect: (info: DatabaseInfo) => void;
  isParsing: boolean;
  setIsParsing: (isParsing: boolean) => void;
}

interface DatabaseSelection {
  database: string;
  parsed: boolean;
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
  const [currentDbSelection, setCurrentDbSelection] = useState("");

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

  const addDatabase = () => {
    if (!currentDbSelection || selectedDbs.some(db => db.database === currentDbSelection)) {
      return;
    }
    
    setSelectedDbs([...selectedDbs, { database: currentDbSelection, parsed: false }]);
    setCurrentDbSelection("");
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
            <Label>Select Databases to Parse</Label>
            
            {/* Selected databases list */}
            {selectedDbs.length > 0 && (
              <div className="mb-4 space-y-2">
                <Label className="text-sm text-gray-600">Selected Databases:</Label>
                <div className="space-y-2">
                  {selectedDbs.map((db) => (
                    <Card key={db.database} className={`bg-gray-50 ${db.parsed ? 'border-green-200' : ''}`}>
                      <CardContent className="p-3 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <DatabaseIcon className="h-4 w-4 text-gray-500" />
                          <span>{db.database}</span>
                          {db.parsed && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Parsed
                            </Badge>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {!db.parsed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleParseDatabase(db.database)}
                              disabled={isParsing}
                              className="h-8 text-xs"
                            >
                              {isParsing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Parse"}
                            </Button>
                          )}
                          <Button
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-gray-500"
                            onClick={() => removeDatabase(db.database)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add database selector */}
            <div className="flex space-x-2">
              <Select 
                value={currentDbSelection} 
                onValueChange={setCurrentDbSelection}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a database" />
                </SelectTrigger>
                <SelectContent>
                  {databases
                    .filter(db => !selectedDbs.some(selected => selected.database === db))
                    .map((db) => (
                      <SelectItem key={db} value={db}>
                        {db}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                onClick={addDatabase}
                disabled={!currentDbSelection}
                size="icon"
                className="h-10 w-10"
              >
                <PlusCircle className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseConnection;
