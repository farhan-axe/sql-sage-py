
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from typing import Optional, Dict, Any, List
import database
import query_generation
from src.services.sql.utils import isNonSqlResponse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI()

# CORS settings to allow cross-origin requests from the frontend
origins = [
    "http://localhost:3000",  # Or the address where your React app is running
    "http://localhost:3001",
    "http://localhost",
    "*"  # WARNING: This is generally not recommended for production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
class ConnectionConfig(BaseModel):
    server: str
    database: str
    useWindowsAuth: bool
    username: Optional[str] = None
    password: Optional[str] = None

class QueryGenerationRequest(BaseModel):
    question: str
    databaseInfo: Dict[str, Any]

class QueryExecutionRequest(BaseModel):
    query: str
    databaseInfo: ConnectionConfig
    maxRows: int = 200

class Refinement(BaseModel):
    query: str
    error: Optional[str] = None

class QueryResult(BaseModel):
    results: list
    refinements: Optional[list[Refinement]] = None

@app.post("/api/sql/connect")
async def connect_and_list_databases(config: ConnectionConfig):
    """
    Connects to the SQL Server and lists available databases.
    """
    try:
        logger.info("Attempting to connect to SQL Server...")
        
        # Build connection string based on authentication type
        if config.useWindowsAuth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};Trusted_Connection=yes;'
        else:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};UID={config.username};PWD={config.password};'

        # Establish connection
        import pyodbc
        cnxn = pyodbc.connect(conn_str, autocommit=True)
        cursor = cnxn.cursor()

        # Retrieve databases
        databases = [row.name for row in cursor.execute("SELECT name FROM sys.databases").fetchall()]
        logger.info(f"Successfully connected. Databases found: {databases}")
        
        return databases
    except Exception as e:
        logger.error(f"Connection Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()

@app.post("/api/sql/execute")
async def execute_query(request: QueryExecutionRequest):
    """
    Executes an SQL query against the database and returns the results.
    """
    try:
        logger.info(f"Executing SQL query: {request.query}")
        
        results = database.execute_sql_query(
            server=request.databaseInfo.server,
            database=request.databaseInfo.database,
            query=request.query,
            use_windows_auth=request.databaseInfo.useWindowsAuth,
            username=request.databaseInfo.username,
            password=request.databaseInfo.password,
            max_rows=request.maxRows
        )
        
        logger.info(f"Query executed successfully. Returning {len(results)} rows.")
        return {"results": results}
    except Exception as e:
        logger.error(f"Query Execution Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sql/terminate")
async def terminate_session(config: ConnectionConfig):
    """
    Terminate all active connections to the specified database.
    """
    try:
        logger.info(f"Attempting to terminate sessions for database: {config.database} on server {config.server}")
        
        # Build connection string to the master database
        if config.useWindowsAuth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};DATABASE=master;Trusted_Connection=yes;'
        else:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config.server};DATABASE=master;UID={config.username};PWD={config.password};'
        
        # Establish connection to the master database
        import pyodbc
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
        
        logger.info(f"Successfully terminated sessions for database: {config.database}")
        return {"message": f"Successfully terminated sessions for database: {config.database}"}
    except Exception as e:
        logger.error(f"Session Termination Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'cnxn' in locals():
            cnxn.close()

@app.post("/api/sql/generate")
async def generate_query(request: QueryGenerationRequest):
    """
    Generates an SQL query using DeepSeek-R1 (or your LLM) via Ollama, 
    returning ONLY the SQL string. (Does NOT execute it.)
    """
    try:
        # Check if the question is not related to database content
        if isNonSqlResponse(request.question):
            logger.warning(f"❌ Non-database question detected: {request.question}")
            raise HTTPException(
                status_code=400,
                detail="This appears to be a general knowledge question not related to database content."
            )
            
        logger.info("🔄 Generating SQL query...")
        
        # Create a well-formatted prompt for query generation
        prompt = query_generation.create_query_prompt(
            request.question, 
            request.databaseInfo
        )
        
        # Get database name for post-processing
        database_name = request.databaseInfo.get('connectionConfig', {}).get('database', '')
        
        logger.info(f"Database Schema (from prompt_template):\n{request.databaseInfo.get('promptTemplate', '')}\n\n")
        logger.info(f"Query Examples:\n{request.databaseInfo.get('queryExamples', '')}\n\n")
        
        # Query the model
        response_text = query_generation.query_ollama(prompt)
        
        print(f"Prompt:\n{prompt}")
        print("\nRaw Ollama response:\n", response_text, "\n")

        if not response_text:
            raise HTTPException(status_code=500, detail="Failed to get a response from the model.")

        # Attempt to extract the SQL query from the returned text
        query, error = query_generation.extract_sql_from_response(response_text)
        if not query:
            raise HTTPException(
                status_code=400,
                detail=error or "No SQL query found in the model's response."
            )
            
        # Make sure all table references use the proper format
        processed_query = query_generation.process_generated_query(query, database_name)

        logger.info(f"✅ Generated SQL Query: {processed_query}")
        return {"query": processed_query}
    except Exception as e:
        logger.error(f"❌ Query Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sql/parse")
async def parse_database_schema(config: ConnectionConfig):
    """
    Parses the database schema and returns a structured representation.
    """
    try:
        logger.info(f"Parsing database schema for {config.database} on {config.server}")
        
        credentials = None
        if not config.useWindowsAuth:
            credentials = {
                'username': config.username,
                'password': config.password
            }
        
        result = database.parse_database(
            server=config.server,
            database=config.database,
            use_windows_auth=config.useWindowsAuth,
            credentials=credentials
        )
        
        return result
    except Exception as e:
        logger.error(f"Schema Parsing Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
