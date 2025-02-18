
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { DatabaseInfo } from "@/types/database";

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

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Mock connection for demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDatabases(["Sales", "Inventory", "CustomerDB"]);
      toast({
        title: "Connected successfully",
        description: "You can now select a database",
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Please check your credentials",
        variant: "destructive",
      });
    }
    setIsConnecting(false);
  };

  const handleParseDatabase = async () => {
    setIsParsing(true);
    try {
      // Mock parsing for demo
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockInfo: DatabaseInfo = {
        tables: [
          {
            name: "Sales",
            schema: ["id", "date", "amount", "customer_id"],
            primaryKey: "id",
            example: "SELECT * FROM Sales WHERE date > '2023-01-01'"
          },
          {
            name: "Customers",
            schema: ["id", "name", "email"],
            primaryKey: "id",
            example: "SELECT name, email FROM Customers WHERE id = 1"
          }
        ],
        promptTemplate: `You are a professional SQL query generator for SQL Server. 
Here are the details of the tables:

1. Sales Table
   Schema: id, date, amount, customer_id
   Primary Key: id
   Example: SELECT * FROM Sales WHERE date > '2023-01-01'

2. Customers Table
   Schema: id, name, email
   Primary Key: id
   Example: SELECT name, email FROM Customers WHERE id = 1`
      };
      
      onConnect(mockInfo);
      toast({
        title: "Database parsed successfully",
        description: "You can now start querying the database",
      });
    } catch (error) {
      toast({
        title: "Parsing failed",
        description: "Error parsing database schema",
        variant: "destructive",
      });
    }
    setIsParsing(false);
  };

  return (
    <div className="space-y-6">
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
            <Select onValueChange={setSelectedDb}>
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
            className="w-full"
          >
            {isParsing ? "Parsing Database..." : "Parse Database"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DatabaseConnection;
