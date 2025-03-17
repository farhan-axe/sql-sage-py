
from fastapi import HTTPException
import pyodbc
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ConnectionConfig(BaseModel):
    server: str
    database: str
    useWindowsAuth: bool
    username: Optional[str] = None
    password: Optional[str] = None

def execute_sql_query(server: str, database: str, query: str, use_windows_auth: bool = True, username: Optional[str] = None, password: Optional[str] = None, max_rows: int = 200) -> list:
    """
    Executes the given SQL query and returns the results.
    """
    try:
        # Construct the connection string
        if use_windows_auth:
            connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;'
        else:
            connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'

        # Establish the connection
        cnxn = pyodbc.connect(connection_string)
        cursor = cnxn.cursor()

        # Execute the query
        cursor.execute(query)

        # Fetch the results
        columns = [column[0] for column in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchmany(max_rows)]

        return rows
    except Exception as e:
        logger.error(f"SQL Execution Error: {str(e)}")
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()

def create_connection(config: ConnectionConfig):
    """
    Creates a database connection based on the provided configuration.
    """
    try:
        # Build connection string based on authentication type
        if config.useWindowsAuth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};Trusted_Connection=yes;'
        else:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};UID={config.username};PWD={config.password};'
            
        # Return the connection string and credentials
        return conn_str
    except Exception as e:
        logger.error(f"Connection Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def parse_database(server, database, use_windows_auth, credentials=None):
    """
    Parses the database schema and returns a structured representation.
    """
    try:
        logger.info(f"Parsing database schema for {database} on {server}")
        
        # Build connection string based on authentication type
        if use_windows_auth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;'
        else:
            username = credentials.get('username')
            password = credentials.get('password')
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
        
        # Establish connection
        cnxn = pyodbc.connect(conn_str)
        cursor = cnxn.cursor()
        
        # First, get all schemas for the database
        cursor.execute("""
            SELECT SCHEMA_NAME
            FROM INFORMATION_SCHEMA.SCHEMATA
            WHERE CATALOG_NAME = DB_NAME()
            AND SCHEMA_NAME <> 'INFORMATION_SCHEMA'
            AND SCHEMA_NAME <> 'sys'
            AND SCHEMA_NAME <> 'guest'
            ORDER BY CASE WHEN SCHEMA_NAME = 'dbo' THEN 0 ELSE 1 END, SCHEMA_NAME
        """)
        
        # Get all schemas, with dbo as default if exists
        schemas = [row.SCHEMA_NAME for row in cursor.fetchall()]
        default_schema = schemas[0] if schemas else 'dbo'  # Default to 'dbo' if no schema found
        
        logger.info(f"Found schemas: {schemas}, using default: {default_schema}")
        
        # Retrieve database schema with all schemas
        cursor.execute("""
            SELECT 
                DB_NAME() as DATABASE_NAME,
                s.name as SCHEMA_NAME,
                t.name as TABLE_NAME,
                c.name as COLUMN_NAME,
                ty.name as DATA_TYPE,
                CASE 
                    WHEN pk.column_id IS NOT NULL THEN 'YES' 
                    ELSE 'NO' 
                END as IS_PRIMARY_KEY
            FROM sys.tables t
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            JOIN sys.columns c ON t.object_id = c.object_id
            JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            LEFT JOIN (
                SELECT ic.object_id, ic.column_id
                FROM sys.indexes i
                JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                WHERE i.is_primary_key = 1
            ) pk ON t.object_id = pk.object_id AND c.column_id = pk.column_id
            ORDER BY t.name, c.column_id
        """)
        
        # Process schema results
        tables = []
        current_table = None
        prompt_template = "### Database Schema:\n\n"
        
        for row in cursor.fetchall():
            db_name = row.DATABASE_NAME
            schema_name = row.SCHEMA_NAME
            table_name = row.TABLE_NAME
            column_name = row.COLUMN_NAME
            data_type = row.DATA_TYPE
            is_primary_key = row.IS_PRIMARY_KEY
            
            table_full_name = f"[{db_name}].[{schema_name}].[{table_name}]"
            table_display_name = f"{schema_name}.{table_name}" if schema_name != default_schema else table_name
            
            if current_table is None or current_table["name"] != table_name or current_table["schema"] != schema_name:
                if current_table is not None:
                    # Find primary key columns for the current table
                    primary_keys = [col["name"] for col in current_table["columns"] if col.get("isPrimaryKey")]
                    current_table["primaryKey"] = ", ".join(primary_keys) if primary_keys else "None defined"
                    tables.append(current_table)
                
                current_table = {
                    "name": table_name,
                    "schema": schema_name,
                    "fullName": table_full_name,
                    "displayName": table_display_name,
                    "columns": []
                }
                prompt_template += f"Table: {table_full_name}\n"
            
            current_table["columns"].append({
                "name": column_name,
                "type": data_type,
                "isPrimaryKey": is_primary_key == "YES"
            })
            
            prompt_template += f"  - {column_name} ({data_type}){' (PK)' if is_primary_key == 'YES' else ''}\n"
        
        if current_table is not None:
            # Find primary key columns for the last table
            primary_keys = [col["name"] for col in current_table["columns"] if col.get("isPrimaryKey")]
            current_table["primaryKey"] = ", ".join(primary_keys) if primary_keys else "None defined"
            tables.append(current_table)

        # If no tables were found
        if not tables:
            prompt_template = "### Database Schema:\n\nNo tables found in the database."
            return {
                "tables": [],
                "promptTemplate": prompt_template,
                "queryExamples": "No tables available to generate examples.",
                "connectionConfig": {
                    "server": server,
                    "database": database,
                    "useWindowsAuth": use_windows_auth
                }
            }

        # Generate example queries based on the schema - fully dynamically
        query_examples = generate_example_queries(db_name, tables)
        
        return {
            "tables": tables,
            "promptTemplate": prompt_template,
            "queryExamples": query_examples,
            "connectionConfig": {
                "server": server,
                "database": database,
                "useWindowsAuth": use_windows_auth
            }
        }
    except Exception as e:
        logger.error(f"Database parsing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()

def generate_example_queries(database_name, tables):
    """
    Generates example SQL queries based on the database schema.
    All examples are dynamically generated based on the actual schema.
    """
    if not tables:
        return "No tables available to generate examples."
    
    examples = "Below are some general examples of questions:\n\n"
    
    # For each table, generate a count query
    for i, table in enumerate(tables[:20], 1):  # Limit to 20 tables for brevity
        table_name = table["displayName"]
        full_table_name = table["fullName"]
        
        examples += f"{i}. Calculate the total number of records in {table_name}?,\n"
        examples += f"Your SQL Query will be like \"SELECT COUNT(*) AS TotalRecords FROM {full_table_name};\"\n\n"
    
    # Add more complex examples if there are multiple tables
    if len(tables) >= 2:
        # Add a SELECT TOP example
        examples += f"{len(tables[:20]) + 1}. Show me the top 10 records from {tables[0]['displayName']}?,\n"
        examples += f"Your SQL Query will be like \"SELECT TOP 10 * FROM {tables[0]['fullName']};\"\n\n"
        
        # Try to find two tables that might be related
        table1 = tables[0]
        table2 = tables[1]
        
        # Look for potential join columns in both tables
        table1_cols = [col["name"] for col in table1["columns"]]
        table2_cols = [col["name"] for col in table2["columns"]]
        
        join_col1 = None
        join_col2 = None
        
        # First, look for exact column name matches (case insensitive)
        for col1 in table1_cols:
            for col2 in table2_cols:
                if col1.lower() == col2.lower():
                    join_col1 = col1
                    join_col2 = col2
                    break
        
        # If no exact match, look for ID columns
        if not join_col1:
            for col1 in table1_cols:
                if "id" in col1.lower() or "key" in col1.lower():
                    join_col1 = col1
                    break
            
            for col2 in table2_cols:
                if "id" in col2.lower() or "key" in col2.lower():
                    join_col2 = col2
                    break
        
        # If still no match, use first columns
        if not join_col1 and table1_cols:
            join_col1 = table1_cols[0]
        
        if not join_col2 and table2_cols:
            join_col2 = table2_cols[0]
        
        if join_col1 and join_col2:
            # Add JOIN example
            examples += f"{len(tables[:20]) + 2}. Join {table1['displayName']} with {table2['displayName']}?,\n"
            examples += f"Your SQL Query will be like \"SELECT t1.*, t2.*\nFROM {table1['fullName']} t1\nJOIN {table2['fullName']} t2 ON t1.{join_col1} = t2.{join_col2};\"\n\n"
        
        # Add GROUP BY example if we can find a good column
        for table in tables[:2]:
            for col in table["columns"]:
                if col["type"].lower() in ["varchar", "nvarchar", "char", "nchar"]:
                    examples += f"{len(tables[:20]) + 3}. Group records in {table['displayName']} by {col['name']}?,\n"
                    examples += f"Your SQL Query will be like \"SELECT {col['name']}, COUNT(*) AS Count\nFROM {table['fullName']}\nGROUP BY {col['name']}\nORDER BY Count DESC;\"\n\n"
                    break
    
    return examples
