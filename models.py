
from pydantic import BaseModel
from typing import Optional, Dict, List, Any, Tuple

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

class QueryExamplesData(BaseModel):
    examples: List[str]
    database: Optional[str] = None

class QueryExamplesSearchRequest(BaseModel):
    query: str
