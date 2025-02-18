
import { DatabaseInfo, TableInfo } from "@/types/database";

interface SqlConnectionConfig {
  server: string;
  useWindowsAuth: boolean;
  username?: string;
  password?: string;
}

interface DatabaseParseResult {
  tables: TableInfo[];
  promptTemplate: string;
}

export async function connectToServer(config: SqlConnectionConfig): Promise<string[]> {
  try {
    // Update the URL to point to your actual backend API endpoint
    const response = await fetch('http://localhost:3001/api/sql/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

export async function parseDatabase(server: string, database: string, useWindowsAuth: boolean, credentials?: { username: string; password: string }): Promise<DatabaseParseResult> {
  try {
    // Update the URL to point to your actual backend API endpoint
    const response = await fetch('http://localhost:3001/api/sql/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        server,
        database,
        useWindowsAuth,
        ...credentials,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse database');
    }

    const data = await response.json();
    return {
      tables: data.tables,
      promptTemplate: generatePromptTemplate(data.tables),
    };
  } catch (error) {
    console.error('Failed to parse database:', error);
    throw error;
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
