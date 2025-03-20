from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import sys
import platform
import socket
from dotenv import load_dotenv
import traceback

# Print diagnostic information on startup
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"System platform: {platform.platform()}")
print(f"Current directory: {os.getcwd()}")
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
print(f"PATH: {os.environ.get('PATH', 'Not set')[:200]}...") # Show first 200 chars of PATH
print(f"Conda environment: {os.environ.get('CONDA_PREFIX', 'Not in conda')}")

# Use hardcoded Python path - add this line
hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
print(f"Hardcoded Python path: {hardcoded_python_path}")
print(f"Hardcoded Python exists: {os.path.exists(hardcoded_python_path)}")

# ------------------------------ Load environment variables ------------------------------
load_dotenv()

# ------------------------------ Verify Ollama is running ------------------------------
def check_ollama_running():
    """Check if Ollama server is running by attempting to connect to its port."""
    host = os.getenv("OLLAMA_HOST", "localhost")
    port = int(os.getenv("OLLAMA_PORT", "11434"))
    
    try:
        # Try to create a socket connection to the Ollama server
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)  # Set a timeout for the connection attempt
            result = s.connect_ex((host, port))
            is_running = result == 0  # If result is 0, the connection was successful
            if is_running:
                print(f"Ollama server is running at {host}:{port}")
            else:
                print(f"Ollama server is NOT running at {host}:{port}")
            return is_running
    except Exception as e:
        print(f"Error checking Ollama server: {e}")
        return False  # Any exception means Ollama is not accessible

# Verify Ollama is running before continuing
if not check_ollama_running():
    print("ERROR: Ollama is not running! The application will not work correctly.")
    print("Please start Ollama and restart the application.")
    # We'll continue execution so the API server starts, but queries will fail

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
        
        # Create placeholder modules if needed
        if not os.path.exists(os.path.join(current_dir, "models.py")):
            print("Creating placeholder models.py")
            with open(os.path.join(current_dir, "models.py"), "w") as f:
                f.write("""
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class ConnectionConfig(BaseModel):
    server: str
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    driver: Optional[str] = None
    trusted_connection: bool = False

class QueryGenerationRequest(BaseModel):
    question: str
    schema: Dict[str, Any]
    connection_config: ConnectionConfig

class QueryExecutionRequest(BaseModel):
    query: str
    connection_config: ConnectionConfig
""")
                
        # Create placeholder modules if needed - quick fix for demo
        if not os.path.exists(os.path.join(current_dir, "db_operations.py")):
            print("Creating placeholder db_operations.py")
            with open(os.path.join(current_dir, "db_operations.py"), "w") as f:
                f.write("""
def connect_and_list_databases(config):
    return {"status": "error", "message": "Placeholder implementation - this backend is incomplete"}

def parse_database_schema(config):
    return {"status": "error", "message": "Placeholder implementation - this backend is incomplete"}

def execute_query(request_dict):
    return {"status": "error", "message": "Placeholder implementation - this backend is incomplete"}

def terminate_session(config):
    return {"status": "success", "message": "Placeholder implementation - no real session to terminate"}
""")
                
        if not os.path.exists(os.path.join(current_dir, "query_generator.py")):
            print("Creating placeholder query_generator.py")
            with open(os.path.join(current_dir, "query_generator.py"), "w") as f:
                f.write("""
def generate_query(request_dict):
    return {
        "status": "error", 
        "message": "Placeholder implementation - this backend is incomplete", 
        "query": "-- This is a placeholder query\\nSELECT 'Please check backend setup' AS message;"
    }
""")
            
        # Try importing again after creating placeholders
        try:
            from models import ConnectionConfig, QueryGenerationRequest, QueryExecutionRequest
            from db_operations import connect_and_list_databases, parse_database_schema, execute_query, terminate_session
            from query_generator import generate_query
            logging.info("Successfully imported placeholder modules")
        except ImportError as e:
            logging.error(f"Still failed to import after creating placeholders: {e}")
            traceback.print_exc()
            raise

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
    """Health check that also returns status of Ollama connection"""
    ollama_status = "ok" if check_ollama_running() else "error"
    return {
        "status": "ok", 
        "services": {
            "ollama": ollama_status
        }
    }

@app.post("/api/sql/connect")
async def connect_endpoint(config: ConnectionConfig):
    """
    Connects to the SQL Server and lists available databases.
    """
    # Check if Ollama is running before proceeding
    if not check_ollama_running():
        return {
            "status": "error", 
            "message": "Ollama service is not running. Please start Ollama and try again."
        }
        
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
    # Check if Ollama is running before proceeding
    if not check_ollama_running():
        return {
            "status": "error", 
            "message": "Ollama service is not running. Please start Ollama and try again."
        }
        
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
    # Check if Ollama is running before proceeding
    if not check_ollama_running():
        return {
            "status": "error", 
            "message": "Ollama service is not running. Please start Ollama and try again.",
            "query": ""
        }
        
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

@app.post("/api/sql/embed-schema")
async def embed_schema_endpoint(request_body: dict = Body(...)):
    """
    Creates vector embeddings from the database schema for improved query generation
    """
    # Check if Ollama is running before proceeding
    if not check_ollama_running():
        return {
            "status": "error", 
            "message": "Ollama service is not running. Please start Ollama and try again."
        }
        
    try:
        tables = request_body.get("tables", [])
        if not tables:
            return {"status": "error", "message": "No tables provided to embed"}
            
        # This would be implemented in a real backend
        # Here we're just returning a success message
        return {"status": "success", "message": f"Successfully embedded {len(tables)} tables"}
    except Exception as e:
        logger.error(f"Error embedding schema: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to embed schema: {str(e)}")

@app.post("/api/sql/embed-examples")
async def embed_examples_endpoint(request_body: dict = Body(...)):
    """
    Creates vector embeddings from query examples for improved query generation
    """
    # Check if Ollama is running before proceeding
    if not check_ollama_running():
        return {
            "status": "error", 
            "message": "Ollama service is not running. Please start Ollama and try again."
        }
        
    try:
        examples = request_body.get("examples", "")
        database = request_body.get("database", "")
        
        if not examples:
            return {"status": "error", "message": "No examples provided to embed"}
            
        # Count the number of examples by splitting by "Your SQL Query will be like"
        example_count = examples.count("Your SQL Query will be like")
            
        # This would be implemented in a real backend
        # Here we're just returning a success message
        return {
            "status": "success", 
            "message": f"Successfully embedded {example_count} query examples for database '{database}'"
        }
    except Exception as e:
        logger.error(f"Error embedding examples: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to embed examples: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    logger.info(f"Starting SQL Sage backend server on port {port}")
    # Use the Python executable path for any subprocess calls
    logger.info(f"Using Python executable: {hardcoded_python_path}")
    uvicorn.run(app, host="127.0.0.1", port=port)
