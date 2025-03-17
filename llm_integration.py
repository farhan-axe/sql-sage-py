
import logging
import re
import requests
import os
from typing import Tuple, Optional, List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def query_ollama(prompt: str) -> str:
    """Send a prompt to the Ollama API and get a response."""
    OLLAMA_URL = "http://localhost:11434/api/generate"
    MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")
    
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "temperature": 0.2
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        response_data = response.json()
        return response_data.get("response", "").strip()
    except requests.RequestException as e:
        logger.error(f"Error querying Ollama: {str(e)}")
        return ""

def extract_sql_from_response(response_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract SQL query from a model response."""
    if not response_text:
        return None, "Empty response from model"
    
    # Try to extract SQL code blocks
    sql_match = re.search(r"```sql\s*([\s\S]*?)\s*```", response_text, re.DOTALL)
    if sql_match:
        query = sql_match.group(1).strip()
        if query:
            return query, None
    
    # Try to find SQL-like patterns if no code block was found
    if re.search(r"\bSELECT\b", response_text, re.IGNORECASE):
        lines = response_text.split("\n")
        sql_lines = []
        in_query = False
        
        for line in lines:
            line = line.strip()
            if re.match(r"\bSELECT\b", line, re.IGNORECASE):
                in_query = True
            
            if in_query:
                sql_lines.append(line)
                if ";" in line:
                    break
        
        if sql_lines:
            query = " ".join(sql_lines).strip()
            if query.endswith(";"):
                query = query[:-1]  # Remove trailing semicolon
            return query, None
    
    # If we couldn't extract a SQL query, return an error
    return None, "No SQL query found in the response"

def formatQueryWithDatabasePrefix(query: str, database_name: str) -> str:
    """
    Format a query to ensure all table references use the proper [DATABASE].[SCHEMA].[TABLE] format.
    This is especially important to prevent table column definitions from being used as schema names.
    """
    if not query or not database_name:
        return query
    
    # First, check if we have a schema that looks like column definitions 
    # (indicating a schema parsing error)
    schema_pattern = r'\[([^]]+)\]\.\[([^]]+)\]'
    schemas = re.findall(schema_pattern, query)
    
    # Process FROM and JOIN table references
    # This regex looks for table references in various formats
    table_pattern = r'\b(FROM|JOIN)\s+(?:\[?([^\s\[\]]+)\]?\.)?(?:\[?([^\s\[\]]+)\]?\.)?(?:\[?([^\s\[\](),;]+)\]?)'
    
    def replace_table_ref(match):
        """Replace table references with proper 3-part names with schema validation"""
        clause = match.group(1)  # FROM or JOIN
        first_part = match.group(2)  # Could be database or schema
        second_part = match.group(3)  # Could be schema or table
        third_part = match.group(4)  # Should be table
        
        # Check if any part looks like column definitions (containing spaces or data types)
        possible_column_def = any(part and re.search(r'\s|int|varchar|char|datetime|nvarchar|text|bit|float', part, re.IGNORECASE) 
                                for part in [first_part, second_part, third_part] if part)
        
        if possible_column_def:
            # Assume dbo schema if we detect column definitions being used as schema
            return f"{clause} [{database_name}].[dbo].[{third_part}]"
        
        if first_part and second_part and third_part:
            # Already has a 3-part name, ensure database is correct
            return f"{clause} [{database_name}].[{second_part}].[{third_part}]"
        elif second_part and third_part:
            # Has schema.table format
            return f"{clause} [{database_name}].[{second_part}].[{third_part}]"
        elif first_part and third_part:
            # Has database.table format (missing schema)
            return f"{clause} [{database_name}].[dbo].[{third_part}]"
        elif third_part:
            # Just has table name
            return f"{clause} [{database_name}].[dbo].[{third_part}]"
        else:
            # Something went wrong, return the original
            logger.warning(f"Unable to parse table reference: {match.group(0)}")
            return match.group(0)
    
    # Apply the replacement
    formatted_query = re.sub(table_pattern, replace_table_ref, query, flags=re.IGNORECASE)
    
    return formatted_query
