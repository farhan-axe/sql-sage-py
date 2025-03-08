
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
        
        # Generate example queries based on the schema
        query_examples = generate_example_queries(db_name, tables)
        
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
