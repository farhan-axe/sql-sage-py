
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import sys
import platform
from dotenv import load_dotenv
import traceback

# Print diagnostic information on startup
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"System platform: {platform.platform()}")
print(f"Current directory: {os.getcwd()}")
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
print(f"PATH: {os.environ.get('PATH', 'Not set')[:200]}...") # Show first 200 chars of PATH

# Import modules with error handling
try:
    from models import ConnectionConfig, QueryGenerationRequest, QueryExecutionRequest
    from db_operations import connect_and_list_databases, parse_database_schema, execute_query, terminate_session
    from query_generator import generate_query
except ImportError as e:
    logging.error(f"Failed to import required modules: {e}")
    # Print diagnostic information
    print(f"Current directory: {os.getcwd()}")
    print(f"Python path: {sys.path}")
    print(f"Modules in directory: {os.listdir(os.path.dirname(__file__))}")
    
    # Attempt to fix path issues
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
        
    # Try importing again
    try:
        from models import ConnectionConfig, QueryGenerationRequest, QueryExecutionRequest
        from db_operations import connect_and_list_databases, parse_database_schema, execute_query, terminate_session
        from query_generator import generate_query
        logging.info("Successfully imported modules after path fix")
    except ImportError as e:
        logging.error(f"Still failed to import after path fix: {e}")
        traceback.print_exc()
        raise

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

# ------------------------------ API Endpoints ------------------------------
@app.get("/")
async def root():
    return {"message": "SQL Sage Backend API is running"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/sql/connect")
async def connect_endpoint(config: ConnectionConfig):
    """
    Connects to the SQL Server and lists available databases.
    """
    try:
        return connect_and_list_databases(config)
    except Exception as e:
        logger.error(f"Error connecting to database: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to connect: {str(e)}")

@app.post("/api/sql/parse")
async def parse_database_endpoint(config: ConnectionConfig):
    """
    Parses the database schema and returns a structured representation.
    """
    try:
        return parse_database_schema(config)
    except Exception as e:
        logger.error(f"Error parsing database schema: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to parse database: {str(e)}")

@app.post("/api/sql/generate")
async def generate_query_endpoint(request: QueryGenerationRequest):
    """
    Generates an SQL query using an LLM via Ollama, returning ONLY the SQL string.
    """
    try:
        return generate_query(request.dict())
    except Exception as e:
        logger.error(f"Error generating query: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to generate query: {str(e)}")

@app.post("/api/sql/execute")
async def execute_query_endpoint(request: QueryExecutionRequest):
    """
    Executes an SQL query against the database and returns the results.
    """
    try:
        return execute_query(request.dict())
    except Exception as e:
        logger.error(f"Error executing query: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to execute query: {str(e)}")

@app.post("/api/sql/terminate")
async def terminate_session_endpoint(config: ConnectionConfig):
    """
    Terminate all active connections to the specified database.
    """
    try:
        return terminate_session(config)
    except Exception as e:
        logger.error(f"Error terminating session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to terminate session: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    logger.info(f"Starting SQL Sage backend server on port {port}")
    uvicorn.run(app, host="127.0.0.1", port=port)
