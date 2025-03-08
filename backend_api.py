from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyodbc
import logging
import re
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def query_ollama(prompt: str):
    """
    Placeholder function to simulate querying an Ollama model.
    Replace this with actual Ollama API call.
    """
    # Simulate an Ollama response (replace with actual API call)
    # This is just a mock, replace with actual Ollama querying logic
    return "Your SQL Query will be like \"SELECT * FROM [Database].[dbo].[Customers];\""

def extract_sql_from_response(response_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extracts the SQL query from the model's response.
    """
    # Look for the SQL query within the "Your SQL Query will be like" format
    import re
    match = re.search(r'Your SQL Query will be like "(.*?)"', response_text, re.DOTALL)
    if match:
        sql_query = match.group(1).strip()
        return sql_query, None  # Return the SQL query and no error

    return None, "No SQL query found in the model's response."  # Indicate that no query was found

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
        
        results = execute_sql_query(
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
        logger.info("🔄 Generating SQL query...")

        # Extract prompt template and query examples from the incoming databaseInfo
        prompt_template = request.databaseInfo.get('promptTemplate', '')
        query_examples = request.databaseInfo.get('queryExamples', '')
        database_name = request.databaseInfo.get('connectionConfig', {}).get('database', '')

        # Clean up the database schema format if needed
        clean_schema = prompt_template.replace('### Database Schema:', '').strip()
        formatted_schema = "Below is the database schema\n" + clean_schema if clean_schema else ""

        # Update any SQL Server syntax issues in the query examples
        # Replace LIMIT with TOP in any examples
        if query_examples:
            query_examples = query_examples.replace("LIMIT", "-- LIMIT (Note: Use TOP instead for SQL Server)")
            
            # Ensure all table references use the format [DATABASE_NAME].[dbo].[TABLE_NAME]
            if database_name:
                # Reformat examples to consistently use [DATABASE].[dbo].[TABLE] format
                def replace_table_reference(match):
                    clause = match.group(1)  # FROM or JOIN
                    table = match.group(2).strip('[]')  # Table name without brackets
                    return f"{clause} [{database_name}].[dbo].[{table}]"
                
                # This regex looks for FROM or JOIN followed by table names without database prefix
                table_regex = r'\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)'
                query_examples = re.sub(table_regex, replace_table_reference, query_examples, flags=re.IGNORECASE)

        logger.info(f"Database Schema (from prompt_template):\n{formatted_schema}\n\n")
        logger.info(f"Query Examples:\n{query_examples}\n\n")

        # Define the output rules in a separate variable, with stronger emphasis on proper table referencing
        output_rules = """
### Output Rules:
1. **CRITICAL: ALL table references MUST use the format [DATABASE_NAME].[dbo].[TABLE_NAME]**
2. **STRICTLY follow the example format: "Your SQL Query will be like \"SQL QUERY HERE\""**
3. **Do NOT include ```sql ``` markup or triple backticks.**
4. **If the question asks for total expenses, use `SUM(amount) AS total_expense`.**
5. **If the question asks for individual transactions, select `name, date, amount, transaction_type, description` and DO NOT use `SUM()` or `GROUP BY`.**
6. **If the question asks for "top" or "largest" or "smallest" or "lowest" transactions, use SQL Server syntax. For example, use `SELECT TOP X ... ORDER BY amount DESC` for top transactions.**
7. **If filtering by a specific month, use `MONTH(date) = MM` instead of checking `month_year = 'YYYY-MM'`.**
8. **Ensure the SQL query is fully executable in SQL Server.**
9. **Do NOT include unnecessary placeholders or variable names—use real column names directly.**
10. **Only return ONE SQL query. No explanations.**
11. **If the query involves more than one table, always consider using table aliases to improve readability and maintainability.**
12. **If the question asks for any query, first validate that the provided table schema contains the required columns and only use column names that exist in the schema.**
13. **Answer the question as straight forward as possible, what has been asked that should be responded, don't think too much.**
14. **If the question asks for Customer Wise, Product Wise or Category Wise Count, for aggregated function then always use GROUP BY CLAUSE.**
15. **Do not include ORDER BY clauses in subqueries, common table expressions, derived tables, inline functions, or views unless accompanied by TOP, OFFSET, or FOR XML, to avoid SQL Server errors.**
16. **Always use SQL Server syntax: use TOP instead of LIMIT for row limitations.**
17. **You MUST respond in the exact format: 'Your SQL Query will be like \"SELECT ... FROM [DATABASE_NAME].[dbo].[TABLE_NAME]\"'**
18. **DO NOT explain your SQL query, just provide the query in the format specified.**
19. **If the question asks for products and sales territory data, ensure you join the tables correctly: DimProduct connects to FactInternetSales via ProductKey, and DimSalesTerritory connects to FactInternetSales via SalesTerritoryKey.**
20. **CRITICAL: ALL table references MUST follow the pattern [DATABASE_NAME].[dbo].[TABLE_NAME], where DATABASE_NAME is the current database name.**
21. **Never omit the database name and schema in table references - always use the full three-part naming convention.**
22. **Always use square brackets around database name, schema and table names to handle special characters and spaces correctly: [DATABASE_NAME].[dbo].[TABLE_NAME]**

"""

        # Build the prompt using a triple-quoted f-string.
        prompt = f"""You are an expert in SQL Server. Your task is to generate a valid SQL Server query for the given question

        
Here is the existing database table:
{formatted_schema}

# Use the user-provided query examples if available, otherwise use the defaults
{query_examples if query_examples else f"""
Below are some general examples of questions:

1. Calculate me the total number of customers?,
Your SQL Query will be like "SELECT COUNT(DISTINCT CustomerKey) FROM [{database_name}].[dbo].[DimCustomer];"

2. Calculate me the total number of customers who have purchased more than 5 products?,
Your SQL Query will be like "WITH InternetSalesCTE AS (
    SELECT CustomerKey, ProductKey
    FROM [{database_name}].[dbo].[FactInternetSales]
)
SELECT SUM(TotalProductsPurchased) FROM (
    SELECT CustomerKey, COUNT(DISTINCT ProductKey) AS TotalProductsPurchased
    FROM InternetSalesCTE
    GROUP BY CustomerKey
    HAVING COUNT(DISTINCT ProductKey) > 5
) x;"

3. Provide me the list of customers who have purchased more than 5 products?,
Your SQL Query will be like "WITH InternetSalesCTE AS (
    SELECT CustomerKey, ProductKey
    FROM [{database_name}].[dbo].[FactInternetSales]
),
CustomerPurchases AS (
    SELECT CustomerKey, COUNT(DISTINCT ProductKey) AS TotalProductsPurchased
    FROM InternetSalesCTE
    GROUP BY CustomerKey
    HAVING COUNT(DISTINCT ProductKey) > 5
)
SELECT d.CustomerKey, d.FirstName, d.LastName, cp.TotalProductsPurchased
FROM [{database_name}].[dbo].[DimCustomer] d
JOIN CustomerPurchases cp ON d.CustomerKey = cp.CustomerKey;"

4. Provide me the top 3 customers with their products and sales?,
Your SQL Query will be like "WITH TopCustomers AS (
    SELECT TOP 3 CustomerKey, SUM(SalesAmount) AS TotalSales
    FROM [{database_name}].[dbo].[FactInternetSales]
    GROUP BY CustomerKey
    ORDER BY TotalSales DESC
),
CustomerProductSales AS (
    SELECT CustomerKey, ProductKey, SUM(SalesAmount) AS ProductSales
    FROM [{database_name}].[dbo].[FactInternetSales]
    GROUP BY CustomerKey, ProductKey
)
SELECT 
    dc.CustomerKey,
    dc.FirstName,
    dc.LastName,
    dp.EnglishProductName AS Product,
    cps.ProductSales
FROM TopCustomers tc
JOIN [{database_name}].[dbo].[DimCustomer] dc ON tc.CustomerKey = dc.CustomerKey
JOIN CustomerProductSales cps ON tc.CustomerKey = cps.CustomerKey
JOIN [{database_name}].[dbo].[DimProduct] dp ON cps.ProductKey = dp.ProductKey
ORDER BY tc.TotalSales DESC, cps.ProductSales DESC;"

5. provide me list of products, sales territory country name and their sales amount?,
Your SQL Query will be like "SELECT TOP 200 
    p.EnglishProductName AS ProductName,
    st.SalesTerritoryCountry AS Country,
    SUM(f.SalesAmount) AS TotalSales
FROM [{database_name}].[dbo].[DimProduct] p
JOIN [{database_name}].[dbo].[FactInternetSales] f ON p.ProductKey = f.ProductKey
JOIN [{database_name}].[dbo].[DimSalesTerritory] st ON st.SalesTerritoryKey = f.SalesTerritoryKey
GROUP BY p.EnglishProductName, st.SalesTerritoryCountry;"
"""}

Here are the output rules:
{output_rules}

IMPORTANT: Your output MUST follow the pattern "Your SQL Query will be like \"SQL QUERY HERE\"". Do not include triple backticks, explanations, or any other text.
You MUST format all table references as [DATABASE_NAME].[dbo].[TABLE_NAME] where DATABASE_NAME is the current database name which is: {database_name}

User Question: {request.question} by looking at existing database table


"""

        logger.info(f"Database Schema (from prompt_template):\n{prompt_template}\n\n")
        logger.info(f"Query Examples:\n{query_examples}\n\n")
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
        if database_name:
            # This regex identifies table references without the database.dbo prefix
            table_regex = r'\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)'
            
            # Replace them with properly formatted references
            def replace_table_ref(match):
                clause = match.group(1)  # FROM or JOIN
                table = match.group(2).strip('[]')  # Table name without brackets
                return f"{clause} [{database_name}].[dbo].[{table}]"
                
            # Apply the regex substitution, with case insensitivity
            query = re.sub(table_regex, replace_table_ref, query, flags=re.IGNORECASE)

        logger.info(f"✅ Generated SQL Query: {query}")
        return {"query": query}

    except Exception as e:
        logger.error(f"❌ Query Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
