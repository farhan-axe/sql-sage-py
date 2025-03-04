
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
import { AlertCircle, InfoIcon, CheckCircle2 } from "lucide-react";

interface DatabaseConnectionProps {
  onConnect: (info: DatabaseInfo) => void;
  isParsing: boolean;
  setIsParsing: (isParsing: boolean) => void;
}

const DatabaseConnection = ({ onConnect, isParsing, setIsParsing }: DatabaseConnectionProps) => {
  const { toast } = useToast();
  const [server, setServer] = useState("");
  const [authType, setAuthType] = useState("windows"); // "windows" or "sql"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedDb, setSelectedDb] = useState("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

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
        description: "You can now select a database",
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

  const handleParseDatabase = async () => {
    setIsParsing(true);
    setConnectionError(null);
    try {
      const parseResult = await parseDatabase(
        server,
        selectedDb,
        authType === "windows",
        authType === "sql" ? { username, password } : undefined
      );

      onConnect(parseResult);
      toast({
        title: "Database parsed successfully",
        description: "You can now start querying the database",
      });
    } catch (error) {
      console.error('Parsing error details:', error);
      setConnectionError(error instanceof Error ? error.message : 'Unknown parsing error');
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
        {isConnecting ? "Connecting..." : "Connect"}
      </Button>

      {databases.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Database</Label>
            <Select onValueChange={setSelectedDb} value={selectedDb}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a database" />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db} value={db}>
                    {db}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleParseDatabase}
            disabled={!selectedDb || isParsing}
            className="w-full bg-blue-700 hover:bg-blue-800"
          >
            {isParsing ? "Parsing Database..." : "Parse Database"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DatabaseConnection;
