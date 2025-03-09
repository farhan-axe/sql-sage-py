
# SQL Sage Python Path Configuration

This document explains how to configure the Python path for SQL Sage.

## PyInstaller Package (No Python Required)

The latest version of SQL Sage uses PyInstaller to package the backend as a standalone executable. This means:

- Users **do not need to have Python installed** to run SQL Sage
- No Python path configuration is necessary
- The application will run using the bundled executable

This is the recommended approach for distributing SQL Sage to end users.

## Python Script Fallback

If the PyInstaller packaging fails or you're using an older version, SQL Sage falls back to using Python scripts. In this case, the following applies:

### Current Configuration

SQL Sage is configured to try these Python paths in order:

1. The system PATH (checking for `python`, `python3`, or `py`)
2. A hardcoded path (if provided): `C:\Users\farha\anaconda3\envs\sqlbot\python.exe`
3. Common Python installation locations based on your operating system

### If You Need to Change the Python Path

If you need to use a specific Python environment, you have these options:

1. **Make sure Python is in the system PATH (recommended)**
   - This is the easiest approach and works for most users
   - SQL Sage will automatically find and use Python from the PATH

2. **Create a python_config.json file** in the application directory with:
   ```json
   {
     "python_path": "C:\\path\\to\\your\\python.exe"
   }
   ```

3. **Modify the hardcoded path** in these files:
   - `backend_utils/environment.py`
   - `backend_utils/build.py`
   - `backend_utils/package_app.py`

### How SQL Sage Finds Python (Script Mode Only)

The application will search for Python in this order:

1. System PATH (using commands like "python", "python3", "py")
2. Hardcoded path (if it exists)
3. Common installation directories based on your operating system
4. As a last resort, it will try to use just "python" and hope it works

## Verifying Your Python Environment (Script Mode Only)

To verify your Python environment is correctly configured:

1. Open a Command Prompt or PowerShell window
2. Run: `python --version`
3. You should see a version number printed (e.g., "Python 3.8.5")
4. Verify required packages are installed:
   ```
   python -c "import fastapi, uvicorn; print('OK')"
   ```

## Troubleshooting (Script Mode Only)

### ENOENT (No such file or directory) Errors

If you see "spawn python ENOENT" errors, it means the application can't find the Python executable. This typically happens when:

1. The Python path is incorrect or doesn't exist
2. The Python executable is not in your system PATH
3. Python is installed but not properly configured

### Package Import Errors

If you see "No module named 'X'" errors, you need to install the required packages in your Python environment:

```bash
python -m pip install fastapi uvicorn pyodbc requests python-dotenv
```

## Troubleshooting Tips

1. For PyInstaller version: Check for error files in the backend directory
2. For Python script version:
   - Make sure Python is installed and accessible from the command line
   - On Windows, ensure Python is added to PATH during installation
   - Check that the Python environment has all required packages installed
3. For either version, make sure Ollama is running
4. If you see permission errors, try running the application as administrator
