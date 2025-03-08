
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
        
        # Retrieve database schema - UPDATED to include database name
        cursor.execute("""
            SELECT 
                DB_NAME() as DATABASE_NAME,
                t.TABLE_NAME,
                c.COLUMN_NAME,
                c.DATA_TYPE,
                CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END as IS_PRIMARY_KEY
            FROM INFORMATION_SCHEMA.TABLES t
            JOIN INFORMATION_SCHEMA.COLUMNS c 
                ON t.TABLE_NAME = c.TABLE_NAME
            LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
                ON c.TABLE_NAME = kcu.TABLE_NAME 
                AND c.COLUMN_NAME = kcu.COLUMN_NAME
                AND kcu.CONSTRAINT_NAME LIKE 'PK%'
            WHERE t.TABLE_TYPE = 'BASE TABLE'
            ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
        """)
        
        # Process schema results
        tables = []
        current_table = None
        prompt_template = "### Database Schema:\n\n"
        
        for row in cursor.fetchall():
            db_name = row.DATABASE_NAME
            table_name = row.TABLE_NAME
            column_name = row.COLUMN_NAME
            data_type = row.DATA_TYPE
            is_primary_key = row.IS_PRIMARY_KEY
            
            if current_table is None or current_table["name"] != table_name:
                if current_table is not None:
                    tables.append(current_table)
                
                current_table = {
                    "name": table_name,
                    "fullName": f"[{db_name}].[dbo].[{table_name}]",  # Added fully qualified name
                    "columns": []
                }
                prompt_template += f"Table: [{db_name}].[dbo].[{table_name}]\n"  # Updated format
            
            current_table["columns"].append({
                "name": column_name,
                "type": data_type,
                "isPrimaryKey": is_primary_key == "YES"
            })
            
            prompt_template += f"  - {column_name} ({data_type}){' (PK)' if is_primary_key == 'YES' else ''}\n"
        
        if current_table is not None:
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

        # Generate example queries based on the schema
        query_examples = generate_example_queries(database, tables)
        
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
    """
    if not tables:
        return "No tables available to generate examples."
    
    examples = "Below are some general examples of questions:\n\n"
    
    # For each table, generate a count query
    for i, table in enumerate(tables[:20], 1):  # Limit to 20 tables for brevity
        table_name = table["name"]
        full_table_name = table["fullName"]  # Use the full qualified name
        
        examples += f"{i}. Calculate me the total number of records in {table_name}?,\n"
        examples += f"Your SQL Query will be like \"SELECT COUNT(*) AS TotalRecords FROM {full_table_name};\"\n\n"
    
    # Add more complex examples if there are multiple tables
    if len(tables) >= 2:
        # Add a SELECT TOP example
        examples += f"{len(tables[:20]) + 1}. Show me the top 10 records from {tables[0]['name']}?,\n"
        examples += f"Your SQL Query will be like \"SELECT TOP 10 * FROM {tables[0]['fullName']};\"\n\n"
        
        # Add a JOIN example if we can find tables that might be related
        examples += f"{len(tables[:20]) + 2}. Join {tables[0]['name']} with {tables[1]['name']}?,\n"
        examples += f"Your SQL Query will be like \"SELECT t1.*, t2.*\nFROM {tables[0]['fullName']} t1\nJOIN {tables[1]['fullName']} t2 ON t1.ID = t2.ID;\"\n\n"
    
    return examples
