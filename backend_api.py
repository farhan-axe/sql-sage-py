
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

        # Clean up the database schema format if needed
        clean_schema = prompt_template.replace('### Database Schema:', '').strip()
        formatted_schema = "Below is the database schema\n" + clean_schema if clean_schema else ""

        # Fix any SQL Server syntax issues in the query examples
        # Replace LIMIT with TOP in any examples
        if query_examples:
            query_examples = query_examples.replace("LIMIT", "-- LIMIT (Note: Use TOP instead for SQL Server)")
            # Add a note about SQL Server syntax if cross-table queries are present
            if "Cross-table queries" in query_examples:
                query_examples += "\n\nNote: In SQL Server, use TOP instead of LIMIT, and remember that ORDER BY cannot be used in subqueries without TOP, OFFSET, or FOR XML."

        logger.info(f"Database Schema (from prompt_template):\n{formatted_schema}\n\n")
        logger.info(f"Query Examples:\n{query_examples}\n\n")

        # Define the output rules in a separate variable.
        output_rules = """
### Output Rules:
1. **STRICTLY follow the example format: "Your SQL Query will be like \"SQL QUERY HERE\""**
2. **Do NOT include ```sql ``` markup or triple backticks.**
3. **If the question asks for total expenses, use `SUM(amount) AS total_expense`.**
4. **If the question asks for individual transactions, select `name, date, amount, transaction_type, description` and DO NOT use `SUM()` or `GROUP BY`.**
5. **If the question asks for "top" or "largest" or "smallest" or "lowest" transactions, use SQL Server syntax. For example, use `SELECT TOP X ... ORDER BY amount DESC` for top transactions.**
6. **If filtering by a specific month, use `MONTH(date) = MM` instead of checking `month_year = 'YYYY-MM'`.**
7. **Ensure the SQL query is fully executable in SQL Server.**
8. **Do NOT include unnecessary placeholders or variable names—use real column names directly.**
9. **Only return ONE SQL query. No explanations.**
10. **If the query involves more than one table, always consider using table aliases to improve readability and maintainability.**
11. **If the question asks for any query, first validate that the provided table schema contains the required columns and only use column names that exist in the schema.**
12. **Answer the question as straight forward as possible, what has been asked that should be responded, don't think too much.**
13. **If the question asks for Customer Wise, Product Wise or Category Wise Count, for aggregated function then always use GROUP BY CLAUSE.**
14. **Do not include ORDER BY clauses in subqueries, common table expressions, derived tables, inline functions, or views unless accompanied by TOP, OFFSET, or FOR XML, to avoid SQL Server errors.**
15. **Always use SQL Server syntax: use TOP instead of LIMIT for row limitations.**
16. **You MUST respond in the exact format: 'Your SQL Query will be like \"SELECT ... FROM ...\"'**

"""

        # Build the prompt using a triple-quoted f-string.
        prompt = f"""You are an expert in SQL Server. Your task is to generate a valid SQL Server query for the given question

        
Here is the existing database table:
{formatted_schema}

# Use the user-provided query examples if available, otherwise use the defaults
{query_examples if query_examples else """
Below are some general examples of questions:

1. Calculate me the total number of customers?,
Your SQL Query will be like "SELECT COUNT(DISTINCT CustomerKey) FROM DimCustomer;"

2. Calculate me the total number of customers who have purchased more than 5 products?,
Your SQL Query will be like "WITH InternetSalesCTE AS (
    SELECT CustomerKey, ProductKey
    FROM FactInternetSales
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
    FROM FactInternetSales
),
CustomerPurchases AS (
    SELECT CustomerKey, COUNT(DISTINCT ProductKey) AS TotalProductsPurchased
    FROM InternetSalesCTE
    GROUP BY CustomerKey
    HAVING COUNT(DISTINCT ProductKey) > 5
)
SELECT d.CustomerKey, d.FirstName, d.LastName, cp.TotalProductsPurchased
FROM DimCustomer d
JOIN CustomerPurchases cp ON d.CustomerKey = cp.CustomerKey;"

4. Provide me the top 3 customers with their products and sales?,
Your SQL Query will be like "WITH TopCustomers AS (
    SELECT TOP 3 CustomerKey, SUM(SalesAmount) AS TotalSales
    FROM FactInternetSales
    GROUP BY CustomerKey
    ORDER BY TotalSales DESC
),
CustomerProductSales AS (
    SELECT CustomerKey, ProductKey, SUM(SalesAmount) AS ProductSales
    FROM FactInternetSales
    GROUP BY CustomerKey, ProductKey
)
SELECT 
    dc.CustomerKey,
    dc.FirstName,
    dc.LastName,
    dp.EnglishProductName AS Product,
    cps.ProductSales
FROM TopCustomers tc
JOIN DimCustomer dc ON tc.CustomerKey = dc.CustomerKey
JOIN CustomerProductSales cps ON tc.CustomerKey = cps.CustomerKey
JOIN DimProduct dp ON cps.ProductKey = dp.ProductKey
ORDER BY tc.TotalSales DESC, cps.ProductSales DESC;"
"""}

Here are the output rules:
{output_rules}

IMPORTANT: Your output MUST follow the pattern "Your SQL Query will be like \"SQL QUERY HERE\"". Do not include triple backticks, explanations, or any other text.

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

        logger.info(f"✅ Generated SQL Query: {query}")
        return {"query": query}

    except Exception as e:
        logger.error(f"❌ Query Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
