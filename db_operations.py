
import logging
import pyodbc
from fastapi import HTTPException
from models import ConnectionConfig
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def connect_and_list_databases(config: ConnectionConfig) -> List[str]:
    """
    Connects to the SQL Server and lists available databases.
    """
    try:
        logger.info(f"🔄 Connecting to SQL Server: {config.server}")

        # Build Connection String
        if config.useWindowsAuth:
            conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};Trusted_Connection=yes;"
        else:
            if not config.username or not config.password:
                logger.error("❌ Missing username/password for SQL authentication.")
                raise HTTPException(
                    status_code=400,
                    detail="Missing username/password for SQL authentication."
                )
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};UID={config.username};PWD={config.password};'

        # Test connection
        cnxn = pyodbc.connect(conn_str, autocommit=True)
        cursor = cnxn.cursor()

        # Retrieve all databases
        databases = [row.name for row in cursor.execute("SELECT name FROM sys.databases").fetchall()]
        
        logger.info(f"✅ Successfully connected to SQL Server. Found {len(databases)} databases.")
        return databases
    
    except Exception as e:
        logger.error(f"❌ Connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()

def parse_database_schema(config: ConnectionConfig) -> Dict[str, Any]:
    """
    Parses the database schema and returns a structured representation.
    """
    try:
        logger.info(f"🔄 Parsing database schema: {config.database}")

        credentials = None
        if not config.useWindowsAuth:
            credentials = {
                'username': config.username,
                'password': config.password
            }
        
        # Build connection string based on authentication type
        if config.useWindowsAuth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};DATABASE={config.database};Trusted_Connection=yes;'
        else:
            username = credentials.get('username')
            password = credentials.get('password')
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};DATABASE={config.database};UID={username};PWD={password};'
        
        # Establish connection
        cnxn = pyodbc.connect(conn_str)
        cursor = cnxn.cursor()
        
        # First, get the default schema for the database
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
            tables.append(current_table)
        
        # If no tables were found
        if not tables:
            prompt_template = "### Database Schema:\n\nNo tables found in the database."
            return {
                "tables": [],
                "promptTemplate": prompt_template,
                "queryExamples": "No tables available to generate examples.",
                "connectionConfig": {
                    "server": config.server,
                    "database": config.database,
                    "useWindowsAuth": config.useWindowsAuth
                }
            }
        
        # Generate example queries based on the schema
        query_examples = generate_example_queries(db_name, tables, default_schema)
        
        logger.info(f"✅ Parsed {len(tables)} tables.")
        return {
            "tables": tables,
            "promptTemplate": prompt_template,
            "queryExamples": query_examples,
            "connectionConfig": {
                "server": config.server,
                "database": config.database,
                "useWindowsAuth": config.useWindowsAuth
            }
        }
    
    except Exception as e:
        logger.error(f"❌ Schema Parsing Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()

def generate_example_queries(database_name, tables, default_schema='dbo'):
    """
    Generates example SQL queries based on the database schema.
    """
    if not tables:
        return "No tables available to generate examples."
    
    examples = "Below are some general examples of questions:\n\n"
    
    # For each table, generate a count query
    for i, table in enumerate(tables[:20], 1):  # Limit to 20 tables for brevity
        table_name = table.get("displayName") or table.get("name")
        full_table_name = table.get("fullName") or f"[{database_name}].[{table.get('schema', default_schema)}].[{table.get('name')}]"
        
        examples += f"{i}. Calculate the total number of records in {table_name}?,\n"
        examples += f"Your SQL Query will be like \"SELECT COUNT(*) AS TotalRecords FROM {full_table_name};\"\n\n"
    
    # Add more complex examples if there are multiple tables
    if len(tables) >= 2:
        # Add a SELECT TOP example
        table0_name = tables[0].get("displayName") or tables[0].get("name")
        full_table0_name = tables[0].get("fullName") or f"[{database_name}].[{tables[0].get('schema', default_schema)}].[{tables[0].get('name')}]"
        
        examples += f"{len(tables[:20]) + 1}. Show me the top 10 records from {table0_name}?,\n"
        examples += f"Your SQL Query will be like \"SELECT TOP 10 * FROM {full_table0_name};\"\n\n"
        
        # Add a JOIN example
        table1_name = tables[1].get("displayName") or tables[1].get("name")
        full_table1_name = tables[1].get("fullName") or f"[{database_name}].[{tables[1].get('schema', default_schema)}].[{tables[1].get('name')}]"
        
        # Try to find potential join columns
        join_col1 = None
        join_col2 = None
        
        # Look for primary keys first
        for col in tables[0].get("columns", []):
            if isinstance(col, dict) and col.get("isPrimaryKey"):
                join_col1 = col.get("name")
                break
        
        for col in tables[1].get("columns", []):
            if isinstance(col, dict) and col.get("isPrimaryKey"):
                join_col2 = col.get("name")
                break
        
        # If no primary keys, look for ID columns
        if not join_col1:
            for col in tables[0].get("columns", []):
                col_name = col.get("name") if isinstance(col, dict) else col
                if col_name and ("id" in col_name.lower() or "key" in col_name.lower()):
                    join_col1 = col_name
                    break
        
        if not join_col2:
            for col in tables[1].get("columns", []):
                col_name = col.get("name") if isinstance(col, dict) else col
                if col_name and ("id" in col_name.lower() or "key" in col_name.lower()):
                    join_col2 = col_name
                    break
        
        # If still no columns found, use first column from each table
        if not join_col1 and tables[0].get("columns") and len(tables[0].get("columns")) > 0:
            col = tables[0].get("columns")[0]
            join_col1 = col.get("name") if isinstance(col, dict) else col
        
        if not join_col2 and tables[1].get("columns") and len(tables[1].get("columns")) > 0:
            col = tables[1].get("columns")[0]
            join_col2 = col.get("name") if isinstance(col, dict) else col
        
        # Default to "ID" if all else fails
        join_col1 = join_col1 or "ID"
        join_col2 = join_col2 or "ID"
        
        examples += f"{len(tables[:20]) + 2}. Join {table0_name} with {table1_name}?,\n"
        examples += f"Your SQL Query will be like \"SELECT t1.*, t2.*\nFROM {full_table0_name} t1\nJOIN {full_table1_name} t2 ON t1.{join_col1} = t2.{join_col2};\"\n\n"
    
    return examples

def execute_query(request: Dict[str, Any]) -> Dict[str, List]:
    """
    Executes an SQL query against the database and returns the results.
    """
    try:
        logger.info(f"🔄 Executing SQL query: {request['query']}")
        
        server = request['databaseInfo']['server']
        database = request['databaseInfo']['database']
        use_windows_auth = request['databaseInfo']['useWindowsAuth']
        max_rows = request.get('maxRows', 200)
        
        # Build connection string based on authentication type
        if use_windows_auth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;'
        else:
            username = request['databaseInfo']['username']
            password = request['databaseInfo']['password']
            if not username or not password:
                raise HTTPException(
                    status_code=400,
                    detail="Missing username or password in databaseInfo."
                )
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
        
        # Connect and execute the query
        cnxn = pyodbc.connect(conn_str)
        cursor = cnxn.cursor()
        cursor.execute(request['query'])
        
        # Get column names
        columns = [desc[0] for desc in cursor.description]
        
        # Fetch the results (limited by maxRows)
        rows = cursor.fetchmany(max_rows)
        results = [dict(zip(columns, row)) for row in rows]
        
        logger.info(f"✅ SQL executed successfully. Returning {len(results)} rows.")
        return {"results": results}
    
    except Exception as e:
        logger.error(f"❌ Execution error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()

def terminate_session(config: ConnectionConfig) -> Dict[str, str]:
    """
    Terminate all active connections to the specified database.
    """
    try:
        logger.info(f"🔄 Terminating session for database: {config.database}")
        
        # Build connection string to the master database
        if config.useWindowsAuth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};DATABASE=master;Trusted_Connection=yes;'
        else:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};DATABASE=master;UID={config.username};PWD={config.password};'
        
        # Establish connection to the master database
        cnxn = pyodbc.connect(conn_str, autocommit=True)
        cursor = cnxn.cursor()
        
        # SQL command to kill all active connections to the target database
        kill_connections_sql = f"""
        DECLARE @SQL varchar(max)
        SELECT @SQL = COALESCE(@SQL + ';', '') + 'KILL ' + CAST(spid AS VARCHAR)
        FROM sys.sysprocesses
        WHERE dbid = DB_ID('{config.database}')
        AND spid <> @@SPID
        
        EXEC(@SQL)
        """
        
        # Execute the command
        cursor.execute(kill_connections_sql)
        
        logger.info(f"✅ Successfully terminated sessions for database: {config.database}")
        return {"message": f"Successfully terminated sessions for database: {config.database}"}
    except Exception as e:
        logger.error(f"❌ Session Termination Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()
