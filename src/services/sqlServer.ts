
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
        ...credentials,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse database');
    }

    const data = await response.json();
    
    // Generate examples for each table
    const tablesWithExamples = await Promise.all(
      data.tables.map(async (table) => {
        const example = await generateTableDescription(table.name, table.schema);
        return {
          ...table,
          example
        };
      })
    );
    
    return {
      tables: tablesWithExamples,
      promptTemplate: generatePromptTemplate(tablesWithExamples),
    };
  } catch (error) {
    console.error('Failed to parse database:', error);
    throw error;
  }
}

async function generateTableDescription(tableName: string, schema: string[]): Promise<string> {
  try {
    // Improved prompt for the backend LLM for more specific table descriptions
    const prompt = `Given a database table named "${tableName}" with the following schema:
${schema.join(', ')}

Create a clear and specific description (15-20 words) that accurately explains:
1. The exact purpose of this table
2. What data it stores
3. Its role in the database (e.g., fact table, dimension table, junction table)

Focus on being precise and specific rather than generic. For example:
- Bad: "Table containing Customer data"
- Good: "Stores customer demographic details and contact information for active purchasers"`;

    // Request the table description from the backend
    const response = await fetch('http://localhost:3001/api/sql/generate-description', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt
      }),
    });

    if (!response.ok) {
      return `Stores ${tableName.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} data`;
    }

    const data = await response.json();
    return data.description || `Stores ${tableName.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} data`;
  } catch (error) {
    console.error('Failed to generate table description:', error);
    // Return a more descriptive fallback that at least humanizes the table name
    return `Stores ${tableName.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} data`;
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
