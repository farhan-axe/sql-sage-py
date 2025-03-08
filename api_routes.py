
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from typing import Optional, Dict, Tuple, List, Any
import pyodbc
import requests
import os
from dotenv import load_dotenv
import re
from src.services.sql.utils import isNonSqlResponse

# ------------------------------ Load environment variables ------------------------------
load_dotenv()

# ------------------------------ Configure Logging ------------------------------
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ------------------------------ FastAPI App Setup ------------------------------
app = FastAPI()

# ------------------------------ Configure CORS ------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------ Request Models ------------------------------
class ConnectionConfig(BaseModel):
    server: str
    database: Optional[str] = None
    useWindowsAuth: bool
    username: Optional[str] = None
    password: Optional[str] = None

class DatabaseParseConfig(BaseModel):
    server: str
    database: str
    useWindowsAuth: bool
    username: Optional[str] = None
    password: Optional[str] = None

class QueryGenerationRequest(BaseModel):
    question: str
    databaseInfo: Dict[str, Any]  # can contain promptTemplate + other info if needed

class QueryExecutionRequest(BaseModel):
    query: str
    databaseInfo: dict  # must contain server, database, useWindowsAuth, etc.
    maxRows: int = 200

class TerminateSessionRequest(BaseModel):
    server: str
    database: str
    useWindowsAuth: bool
    username: Optional[str] = None
    password: Optional[str] = None

class Refinement(BaseModel):
    query: str
    error: Optional[str] = None

class QueryResult(BaseModel):
    results: list
    refinements: Optional[list[Refinement]] = None

class QueryRefinementAttempt(BaseModel):
    attempt: int
    query: str
    error: Optional[str] = None
    response: Optional[str] = None

# ------------------------------ Constants ------------------------------
OLLAMA_URL = "http://localhost:11434/api/generate"  # Ollama API endpoint
MAX_RETRIES = 3  # Define max retries for SQL refinement
MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")

# ------------------------------ Helper Functions ------------------------------
def query_ollama(prompt: str) -> str:
    """Send a request to the Ollama server for SQL generation."""
    payload = {"model": MODEL, "prompt": prompt, "stream": False, "temperature": 0.2}
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get("response", "").strip()
    except requests.RequestException as e:
        logger.error(f"❌ Error querying Ollama: {str(e)}")
        return None

def extract_sql_from_response(response_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract the final SQL query and the AI's thought process from the model's response."""
    # Extract the chain-of-thought (if any) for debugging.
    think_match = re.search(r"<think>(.*?)</think>", response_text, flags=re.DOTALL)
    think_text = think_match.group(1).strip() if think_match else None

    # If there is a </think> tag, consider only the text after it.
    if think_match:
        post_think_text = response_text[think_match.end():]
    else:
        post_think_text = response_text

    # Find all SQL code blocks in the considered text.
    sql_matches = re.findall(r"```sql\s*(.*?)\s*```", post_think_text, flags=re.DOTALL)
    
    # Return the last SQL code block if any are found.
    query = sql_matches[-1].strip() if sql_matches else None

    return query, think_text

def refine_sql_with_feedback(sql: str, error_msg: str) -> str:
    """Refine SQL query based on error feedback and return only the refined SQL."""
    feedback_prompt = f"""
    The following SQL query failed to execute:

    ```sql
    {sql}
    ```

    The error message returned was:
    "{error_msg}"

    Please generate only the corrected SQL query with no additional explanation or comments.
    """
    refined_sql_response = query_ollama(feedback_prompt)
    refined_sql, _ = extract_sql_from_response(refined_sql_response)
    return refined_sql if refined_sql else sql

# ------------------------------ API Endpoints ------------------------------
@app.post("/api/sql/connect")
async def connect_and_list_databases(config: ConnectionConfig):
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

@app.post("/api/sql/parse")
async def parse_database_schema(config: ConnectionConfig):
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
        
        # Extract prompt template and query examples from the incoming databaseInfo
        prompt_template = request.databaseInfo.get('promptTemplate', '')
        query_examples = request.databaseInfo.get('queryExamples', '')
        database_name = request.databaseInfo.get('connectionConfig', {}).get('database', '')

        # Clean up the database schema format if needed
        clean_schema = prompt_template.replace('### Database Schema:', '').strip()
        formatted_schema = "Below is the database schema\n" + clean_schema if clean_schema else ""

        logger.info(f"Database Schema (from prompt_template):\n{prompt_template}\n\n")
        logger.info(f"Query Examples:\n{query_examples}\n\n")
        
        # Define the output rules in a separate variable.
        output_rules = """
Output Rules:
1. **STRICTLY output only the SQL query inside triple backticks (e.g., ```sql ... ```).**
2. **Do NOT include any explanations, comments, or descriptions outside of the SQL query block.**
3. **If the question requests total expenses, use `SUM(amount) AS total_expense`.**
4. **If the question requests individual transactions, select `name, date, amount, transaction_type, description` and do not use aggregation functions or GROUP BY.**
5. **For queries asking for "top", "largest", "smallest", or "lowest" transactions, use SQL Server syntax (e.g., `SELECT TOP X ... ORDER BY amount DESC`).**
6. **When filtering by a specific month, use `MONTH(date) = MM` rather than comparing to a string like `'YYYY-MM'`.**
7. **Ensure the SQL query is fully executable in SQL Server.**
8. **Do not include unnecessary placeholders or variable names; use actual column names directly.**
9. **Return only ONE SQL query. No additional explanations are allowed.**
10. **If the query involves more than one table, use table aliases to improve readability and maintainability.**
11. **Always adhere strictly to the provided table schema; do not assume any table or column names that are not explicitly given.**
12. **Answer the question as directly and straightforwardly as possible, including only what is requested.**
13. **When using aggregated functions (AVG, MIN, MAX, SUM, COUNT) for grouped data (e.g., customer-wise, product-wise, or category-wise counts), include a corresponding GROUP BY clause.**
14. **Avoid including ORDER BY clauses in subqueries, common table expressions, derived tables, inline functions, or views unless accompanied by TOP, OFFSET, or FOR XML to avoid SQL Server errors.**
15. **When employing window functions or aggregation with an OVER() clause, ensure proper SQL Server syntax with appropriate use of PARTITION BY and ORDER BY within the OVER() clause.**
16. **Always verify the SQL query syntax by cross-checking the provided table names, JOIN conditions, GROUP BY clauses, table aliases, and column names.**
17. **If an exact column name is missing and feature engineering is necessary, apply the appropriate feature engineering techniques using available information.**
18. **CRITICAL: ALL table references MUST follow the pattern [DATABASE_NAME].[dbo].[TABLE_NAME], where DATABASE_NAME is the current database name.**
19. **Never omit the database name and schema in table references - always use the full three-part naming convention.**
20. **Always use square brackets around database name, schema and table names to handle special characters and spaces correctly: [DATABASE_NAME].[dbo].[TABLE_NAME]**
"""

        # Build the prompt using a triple-quoted f-string.
        prompt = f"""You are an expert in SQL Server. Your task is to generate a valid SQL Server query for the given question

{formatted_schema}

Use the user-provided query examples if available:
{query_examples if query_examples else None}

Here are the output rules:
{output_rules}

IMPORTANT: Your output MUST be a SQL query enclosed in a code block with SQL syntax highlighting (```sql ... ```).
You MUST format all table references as [DATABASE_NAME].[dbo].[TABLE_NAME] where DATABASE_NAME is the current database name which is: {database_name}

User Question: {request.question}
"""

        response_text = query_ollama(prompt)
        
        print(f"Prompt:\n{prompt}")
        print("\nRaw Ollama response:\n", response_text, "\n")

        if not response_text:
            raise HTTPException(status_code=500, detail="Failed to get a response from the model.")

        # Attempt to extract the SQL query from the returned text
        query, _ = extract_sql_from_response(response_text)
        if not query:
            raise HTTPException(
                status_code=400,
                detail="No SQL query found in the model's response."
            )
            
        # Make sure all table references use the proper format
        processed_query = formatQueryWithDatabasePrefix(query, database_name)

        logger.info(f"✅ Generated SQL Query: {processed_query}")
        return {"query": processed_query}

    except Exception as e:
        logger.error(f"❌ Query Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def formatQueryWithDatabasePrefix(query: str, databaseName: str) -> str:
    """
    Formats a query with the database prefix for tables that don't have it.
    """
    if not databaseName:
        return query

    # This regex identifies table references without the database.dbo prefix
    table_regex = r'\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)'
    
    # Replace them with properly formatted references
    def replace_table_ref(match):
        clause = match.group(1)  # FROM or JOIN
        table = match.group(2).strip('[]')  # Table name without brackets
        return f"{clause} [{databaseName}].[dbo].[{table}]"
            
    # Apply the regex substitution, with case insensitivity
    return re.sub(table_regex, replace_table_ref, query, flags=re.IGNORECASE)

@app.post("/api/sql/execute")
async def execute_query(request: QueryExecutionRequest):
    """
    Executes an SQL query against the database and returns the results.
    """
    try:
        logger.info(f"🔄 Executing SQL query: {request.query}")
        
        server = request.databaseInfo.server
        database = request.databaseInfo.database
        
        # Build connection string based on authentication type
        if request.databaseInfo.useWindowsAuth:
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;'
        else:
            username = request.databaseInfo.username
            password = request.databaseInfo.password
            if not username or not password:
                raise HTTPException(
                    status_code=400,
                    detail="Missing username or password in databaseInfo."
                )
            conn_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
        
        # Connect and execute the query
        cnxn = pyodbc.connect(conn_str)
        cursor = cnxn.cursor()
        cursor.execute(request.query)
        
        # Get column names
        columns = [desc[0] for desc in cursor.description]
        
        # Fetch the results (limited by maxRows)
        rows = cursor.fetchmany(request.maxRows)
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

@app.post("/api/sql/terminate")
async def terminate_session(config: ConnectionConfig):
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
