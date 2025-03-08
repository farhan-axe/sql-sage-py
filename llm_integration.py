
import re
import logging
import requests
import os
from typing import Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Constants
OLLAMA_URL = "http://localhost:11434/api/generate"  # Ollama API endpoint
MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")

def query_ollama(prompt: str) -> str:
    """Send a request to the Ollama server for SQL generation."""
    payload = {"model": MODEL, "prompt": prompt, "stream": False, "temperature": 0.2}
    try:
        logger.debug(f"Querying Ollama model: {MODEL}")
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        response_data = response.json()
        logger.debug("Received response from Ollama")
        return response_data.get("response", "").strip()
    except requests.RequestException as e:
        logger.error(f"❌ Error querying Ollama: {str(e)}")
        return f"Error connecting to Ollama: {str(e)}"

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

    # Check if the response indicates a non-SQL question
    non_sql_indicators = [
        "i'm sorry",
        "i am sorry",
        "i cannot",
        "i can't",
        "cannot generate",
        "can't generate",
        "unable to generate",
        "doesn't appear to be",
        "does not appear to be",
        "not related to",
        "not a database",
        "not database",
        "no relevant data",
        "no database",
        "data is not available",
        "outside the scope"
    ]
    
    # Check if response contains non-SQL indicators
    for indicator in non_sql_indicators:
        if indicator.lower() in post_think_text.lower():
            logger.warning(f"Detected non-SQL response: '{indicator}' found in text")
            return None, think_text

    # Find all SQL code blocks in the considered text.
    sql_matches = re.findall(r"```sql\s*(.*?)\s*```", post_think_text, flags=re.DOTALL)
    
    # If no SQL code blocks found, try to find a SELECT statement
    if not sql_matches:
        # Look for SELECT statements
        select_match = re.search(r"(SELECT\s+.*?)(;|$)", post_think_text, flags=re.DOTALL | re.IGNORECASE)
        if select_match:
            query = select_match.group(1).strip()
            logger.debug(f"Extracted SELECT statement: {query[:50]}...")
            return query, think_text
        logger.warning("No SQL code blocks or SELECT statements found")
        return None, think_text
    
    # Return the last SQL code block if any are found.
    query = sql_matches[-1].strip()
    logger.debug(f"Extracted SQL from code block: {query[:50]}...")
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
    logger.debug(f"Refining SQL with error feedback: {error_msg}")
    refined_sql_response = query_ollama(feedback_prompt)
    refined_sql, _ = extract_sql_from_response(refined_sql_response)
    if not refined_sql:
        logger.warning("Failed to extract refined SQL from response")
        return sql  # Return original if no refinement could be extracted
    logger.debug(f"SQL refined successfully: {refined_sql[:50]}...")
    return refined_sql

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
