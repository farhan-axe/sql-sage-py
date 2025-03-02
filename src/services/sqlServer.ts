
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
- Good: "Stores customer demographic details and contact information for active purchasers"

For dimension tables, include how they relate to fact tables using their keys.
For fact tables, mention what metrics or transactions they track.
For example:
- "DimCurrency table provides currency reference data identified by CurrencyKey for financial transactions"
- "FactSales table records all sales transactions with revenue metrics and links to dimension tables"`;

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
      // Create a more descriptive fallback based on table name pattern
      if (tableName.startsWith('Dim')) {
        return `Reference data for ${tableName.replace('Dim', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase()} identified by ${schema.find(col => col.includes('Key')) || 'primary key'}`;
      } else if (tableName.startsWith('Fact')) {
        return `Stores metrics and transactions for ${tableName.replace('Fact', '').replace(/([A-Z])/g, ' $1').trim().toLowerCase()} with dimensional references`;
      } else {
        return `Stores ${tableName.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} data with ${schema.length} attributes`;
      }
    }

    const data = await response.json();
    return data.description || generateFallbackDescription(tableName, schema);
  } catch (error) {
    console.error('Failed to generate table description:', error);
    // Return a more intelligent fallback based on naming conventions
    return generateFallbackDescription(tableName, schema);
  }
}

function generateFallbackDescription(tableName: string, schema: string[]): string {
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
