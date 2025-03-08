
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import logging
from dotenv import load_dotenv
from models import ConnectionConfig, QueryGenerationRequest, QueryExecutionRequest
from db_operations import connect_and_list_databases, parse_database_schema, execute_query, terminate_session
from query_generator import generate_query

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
@app.post("/api/sql/connect")
async def connect_endpoint(config: ConnectionConfig):
    """
    Connects to the SQL Server and lists available databases.
    """
    return connect_and_list_databases(config)

@app.post("/api/sql/parse")
async def parse_database_endpoint(config: ConnectionConfig):
    """
    Parses the database schema and returns a structured representation.
    """
    return parse_database_schema(config)

@app.post("/api/sql/generate")
async def generate_query_endpoint(request: QueryGenerationRequest):
    """
    Generates an SQL query using an LLM via Ollama, returning ONLY the SQL string.
    """
    return generate_query(request.dict())

@app.post("/api/sql/execute")
async def execute_query_endpoint(request: QueryExecutionRequest):
    """
    Executes an SQL query against the database and returns the results.
    """
    return execute_query(request.dict())

@app.post("/api/sql/terminate")
async def terminate_session_endpoint(config: ConnectionConfig):
    """
    Terminate all active connections to the specified database.
    """
    return terminate_session(config)
