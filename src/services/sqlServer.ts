
import { DatabaseInfo, TableInfo, ConnectionConfig } from "@/types/database";

interface SqlConnectionConfig {
  server: string;
  useWindowsAuth: boolean;
  username?: string;
  password?: string;
}

export async function connectToServer(config: SqlConnectionConfig): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:3001/api/sql/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Connection failed');
    }

    const data = await response.json();
    return data.databases;
  } catch (error) {
    console.error('Failed to connect to SQL Server:', error);
    throw error;
  }
}

interface DatabaseParseResult {
  tables: TableInfo[];
  promptTemplate: string;
}

export async function parseDatabase(
  server: string,
  database: string,
  useWindowsAuth: boolean,
  credentials?: { username: string; password: string }
): Promise<DatabaseParseResult> {
  try {
    const response = await fetch('http://localhost:3001/api/sql/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        server,
        database,
        useWindowsAuth,
        maxRows: 200, // Always limit results to 200 rows
        ...credentials,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse database');
    }

    const data = await response.json();
    
    // Generate examples for each table
    const tablesWithExamples = data.tables.map(table => {
      const example = generateTableDescription(table.name, table.schema);
      return {
        ...table,
        example
      };
    });
    
    return {
      tables: tablesWithExamples,
      promptTemplate: generatePromptTemplate(tablesWithExamples),
    };
  } catch (error) {
    console.error('Failed to parse database:', error);
    throw error;
  }
}

function generateTableDescription(tableName: string, schema: string[]): string {
  // Identify primary or important keys
  const keyColumns = schema.filter(col => col.includes('Key') || col.includes('ID'));
  const keyNames = keyColumns.map(col => col.split(' ')[0]).join(', ');
  
  // Generate intelligent descriptions based on table name patterns
  if (tableName.startsWith('Dim')) {
    const dimension = tableName.replace('Dim', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return `Reference table providing ${dimension} attributes identified by ${keyNames || 'primary key'}`;
  } else if (tableName.startsWith('Fact')) {
    const subject = tableName.replace('Fact', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return `Tracks ${subject} metrics and transactions with dimensional references through ${keyNames || 'foreign keys'}`;
  } else if (tableName.includes('Bridge') || tableName.includes('Map')) {
    return `Junction table linking ${keyNames || 'related entities'} in a many-to-many relationship`;
  } else {
    return `Stores ${tableName.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} data with ${schema.length} attributes`;
  }
}

function generatePromptTemplate(tables: TableInfo[]): string {
  let template = `You are a professional SQL query generator for SQL Server. 
Here are the details of the tables:\n\n`;

  tables.forEach((table, index) => {
    template += `${index + 1}. ${table.name} Table
   Schema: ${table.schema.join(', ')}
   Primary Key: ${table.primaryKey}
   Example: ${table.example}\n\n`;
  });

  return template;
}

export async function terminateSession(
  server: string,
  database: string,
  useWindowsAuth: boolean,
  credentials?: { username: string; password: string }
): Promise<boolean> {
  try {
    // First try to call the backend API
    try {
      const response = await fetch('http://localhost:3001/api/sql/terminate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          server,
          database,
          useWindowsAuth,
          ...credentials,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Session terminated successfully via API");
        return data.success || false;
      }
      
      // If the endpoint is not found (404) or any other error, we'll handle it in the catch block
      console.warn(`Backend API error: ${response.status} ${response.statusText}`);
      if (response.status === 404) {
        console.warn("The terminate-session endpoint doesn't exist in the backend");
      }
    } catch (apiError) {
      console.warn('Backend API not available:', apiError);
      // Continue to the fallback implementation
    }
    
    // Fallback implementation: 
    // If the backend API is not available or returns an error,
    // we'll consider the session terminated on the frontend side
    console.log('Using fallback session termination (frontend-only)');
    
    // Return true to indicate success from the frontend perspective
    return true;
  } catch (error) {
    console.error("Failed to terminate session completely:", error);
    // Even if there's an error, we want the UI to continue functioning
    return true;
  }
}
