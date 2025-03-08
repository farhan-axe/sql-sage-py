
# SQL Sage - AI-powered SQL Query Generator

SQL Sage is an application that connects to your SQL Server databases and uses AI to generate SQL queries from natural language questions.

## Requirements

1. **Windows, macOS, or Linux** operating system
2. **SQL Server** with ODBC Driver 17 installed (for database connections)
3. **Ollama** for AI query generation (installation instructions included)

## Installation

### Step 1: Install SQL Server ODBC Driver

**Windows:**
- Download and install the Microsoft ODBC Driver 17 for SQL Server from the [Microsoft Download Center](https://www.microsoft.com/en-us/download/details.aspx?id=56567)

**macOS:**
```bash
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install msodbcsql17
```

**Linux (Ubuntu):**
```bash
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list > /etc/apt/sources.list.d/mssql-release.list
apt-get update
apt-get install -y msodbcsql17
```

### Step 2: Install Ollama

1. Download and install Ollama from [ollama.ai](https://ollama.ai)
2. Open a terminal or command prompt and run:
   ```bash
   ollama pull deepseek-r1:8b
   ```
   For better performance (but higher resource usage), you can use:
   ```bash
   ollama pull deepseek-r1:14b
   ```

### Step 3: Run SQL Sage

1. Ensure Ollama is running
2. Start the SQL Sage application by running the executable

## Configuration

You can customize the AI model used by editing the `.env` file in the application directory:

```
# Ollama Configuration
OLLAMA_MODEL=deepseek-r1:14b  # Change to your preferred model

# Server Configuration
PORT=3001  # Change port if needed
```

## Troubleshooting

- **Connection errors:** Ensure SQL Server is running and accessible
- **AI query generation errors:** Make sure Ollama is running and the model is downloaded
- **No results returned:** Check your SQL permissions and database access rights

## Privacy & Security

- SQL Sage runs completely offline - no internet connection is required once Ollama and models are installed
- Your database schema and queries are not sent to any external services
- All AI processing happens locally on your machine

## Support

For help or to report issues, please create an issue on the GitHub repository.
