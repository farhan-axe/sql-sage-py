
import logging
import re
from typing import Optional, Dict, Any, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    match = re.search(r'Your SQL Query will be like "(.*?)"', response_text, re.DOTALL)
    if match:
        sql_query = match.group(1).strip()
        return sql_query, None  # Return the SQL query and no error

    return None, "No SQL query found in the model's response."  # Indicate that no query was found

def format_query_examples(database_name: str, query_examples: str) -> str:
    """
    Format query examples to use the correct [DATABASE].[dbo].[TABLE] format
    """
    if not query_examples:
        return ""
    
    # Replace LIMIT with TOP in any examples
    formatted_examples = query_examples.replace("LIMIT", "-- LIMIT (Note: Use TOP instead for SQL Server)")
    
    # Ensure all table references use the format [DATABASE_NAME].[dbo].[TABLE_NAME]
    if database_name:
        # Reformat examples to consistently use [DATABASE].[dbo].[TABLE] format
        def replace_table_reference(match):
            clause = match.group(1)  # FROM or JOIN
            table = match.group(2).strip('[]')  # Table name without brackets
            return f"{clause} [{database_name}].[dbo].[{table}]"
        
        # This regex looks for FROM or JOIN followed by table names without database prefix
        table_regex = r'\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)'
        formatted_examples = re.sub(table_regex, replace_table_reference, formatted_examples, flags=re.IGNORECASE)
    
    return formatted_examples

def create_query_prompt(request_question: str, database_info: Dict[str, Any]) -> str:
    """
    Create a well-formatted prompt for query generation
    """
    # Extract prompt template and query examples from the incoming databaseInfo
    prompt_template = database_info.get('promptTemplate', '')
    query_examples = database_info.get('queryExamples', '')
    database_name = database_info.get('connectionConfig', {}).get('database', '')

    # Clean up the database schema format if needed
    clean_schema = prompt_template.replace('### Database Schema:', '').strip()
    formatted_schema = "Below is the database schema\n" + clean_schema if clean_schema else ""

    # Update any SQL Server syntax issues in the query examples
    formatted_examples = format_query_examples(database_name, query_examples)

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
{formatted_examples if formatted_examples else f"No examples available for database {database_name}"}

Here are the output rules:
{output_rules}

IMPORTANT: Your output MUST follow the pattern "Your SQL Query will be like \"SQL QUERY HERE\"". Do not include triple backticks, explanations, or any other text.
You MUST format all table references as [DATABASE_NAME].[dbo].[TABLE_NAME] where DATABASE_NAME is the current database name which is: {database_name}

User Question: {request_question} by looking at existing database table


"""
    return prompt

def process_generated_query(query: str, database_name: str) -> str:
    """
    Process the generated query to ensure it follows the required format
    """
    if database_name and query:
        # This regex identifies table references without the database.dbo prefix
        table_regex = r'\b(FROM|JOIN)\s+(?!\[?[\w]+\]?\.\[?[\w]+\]?\.\[?)([\w\[\]]+)'
        
        # Replace them with properly formatted references
        def replace_table_ref(match):
            clause = match.group(1)  # FROM or JOIN
            table = match.group(2).strip('[]')  # Table name without brackets
            return f"{clause} [{database_name}].[dbo].[{table}]"
                
        # Apply the regex substitution, with case insensitivity
        return re.sub(table_regex, replace_table_ref, query, flags=re.IGNORECASE)
    
    return query
