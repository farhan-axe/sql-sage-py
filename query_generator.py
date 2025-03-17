
import logging
import requests
import os
from fastapi import HTTPException
from typing import Dict, Any, Optional
from llm_integration import query_ollama, extract_sql_from_response, formatQueryWithDatabasePrefix
from src.services.sql.utils import isNonSqlResponse

# Configure logging
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def generate_query(request: Dict[str, Any]) -> Dict[str, str]:
    """
    Generates an SQL query using DeepSeek-R1 (or your LLM) via Ollama, 
    returning ONLY the SQL string. (Does NOT execute it.)
    """
    try:
        # Check if the question is not related to database content
        if isNonSqlResponse(request["question"]):
            logger.warning(f"❌ Non-database question detected: {request['question']}")
            raise HTTPException(
                status_code=400,
                detail="This appears to be a general knowledge question not related to database content."
            )
            
        logger.info("🔄 Generating SQL query...")
        
        # Extract prompt template and query examples from the incoming databaseInfo
        prompt_template = request["databaseInfo"].get('promptTemplate', '')
        query_examples = request["databaseInfo"].get('queryExamples', '')
        database_name = request["databaseInfo"].get('connectionConfig', {}).get('database', '')

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
18. **CRITICAL: ALL table references MUST follow the pattern [DATABASE_NAME].[SCHEMA_NAME].[TABLE_NAME], where DATABASE_NAME is the current database name.**
19. **Never omit the database name and schema in table references - always use the full three-part naming convention.**
20. **Always use square brackets around database name, schema and table names to handle special characters and spaces correctly: [DATABASE_NAME].[SCHEMA_NAME].[TABLE_NAME]**
"""

        # Build the prompt using a triple-quoted f-string.
        prompt = f"""You are an expert in SQL Server. Your task is to generate a valid SQL Server query for the given question

{formatted_schema}

Use the user-provided query examples if available:
{query_examples if query_examples else None}

Here are the output rules:
{output_rules}

IMPORTANT: Your output MUST be a SQL query enclosed in a code block with SQL syntax highlighting (```sql ... ```).
You MUST format all table references with full three-part names: [DATABASE_NAME].[SCHEMA_NAME].[TABLE_NAME] where:
- DATABASE_NAME is the current database name which is: {database_name}
- SCHEMA_NAME should be taken from the table definition in the schema above (not assumed)
- TABLE_NAME should exactly match what's in the schema

User Question: {request['question']}
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
