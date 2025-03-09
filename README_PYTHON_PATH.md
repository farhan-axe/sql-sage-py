
# SQL Sage Python Path Configuration

This document explains how to configure the Python path for SQL Sage.

## PyInstaller Package (No Python Required)

The latest version of SQL Sage uses PyInstaller to package the backend as a standalone executable. This means:

- Users **do not need to have Python installed** to run SQL Sage
- No Python path configuration is necessary
- The application will run using the bundled executable

This is the recommended approach for distributing SQL Sage to end users.

## Troubleshooting Backend Launch Issues

If the backend is not starting or closes immediately after launch, try these steps:

1. **Check for error logs:**
   - Look in the `backend` directory for any `.err` files
   - These files contain error information that can help diagnose issues

2. **Run the backend manually:**
   - Open a command prompt
   - Navigate to the `backend` directory
   - Run `run_backend.bat` (Windows) or `python run_backend.py` (Mac/Linux)
   - This will show any error messages that might be occurring

3. **Common issues:**
   - **Missing dependencies:** The backend might be missing required libraries
   - **Ollama not running:** Ensure Ollama is running before starting the application
   - **Port conflicts:** Another application might be using port 3001 or 5000

## Python Script Fallback

If the PyInstaller packaging fails or you're using an older version, SQL Sage falls back to using Python scripts. In this case, the following applies:

### Configuring the Python Path

SQL Sage is configured to try these Python paths in order:

1. A custom path defined in `python_config.json` (if you created one)
2. The hardcoded path (if it exists): `C:\Users\farha\anaconda3\envs\sqlbot\python.exe`
3. Common Python installation locations based on your operating system
4. Any Python executable found in the system PATH (using its full absolute path)

### Creating a python_config.json File

If you need to use a specific Python environment, create a `python_config.json` file in the application directory with:

```json
{
  "python_path": "C:\\path\\to\\your\\python.exe"
}
```

**Important:** Use double backslashes in Windows paths, and make sure the path exists on your system.

### Testing Your Python Environment

To test if your Python environment has all the required dependencies:

```bash
# Install the required packages
python -m pip install fastapi uvicorn pyodbc requests python-dotenv
```

## For Developers: Understanding How SQL Sage Finds Python

The application searches for Python in this order:

1. Custom path in `python_config.json` (if present)
2. Hardcoded path (if it exists)
3. Common installation directories based on your operating system
4. Full absolute path of any Python executable found in system PATH
5. As a last resort, it will try to use just "python" and hope it works

When launching the backend, SQL Sage will ALWAYS use the full absolute path to Python, not just the command "python". This helps prevent "ENOENT" errors.
