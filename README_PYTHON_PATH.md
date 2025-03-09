
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

1. A custom path defined in `python_config.json` (if you created one)
2. The hardcoded path (if it exists): `C:\Users\farha\anaconda3\envs\sqlbot\python.exe`
3. Common Python installation locations based on your operating system
4. Any Python executable found in the system PATH (using its full absolute path)

### If You Need to Change the Python Path

If you need to use a specific Python environment, you have these options:

1. **Create a python_config.json file** in the application directory with:
   ```json
   {
     "python_path": "C:\\path\\to\\your\\python.exe"
   }
   ```

2. **Modify the hardcoded path** in these files:
   - `backend_utils/environment.py`
   - `backend_utils/build.py`
   - `backend_utils/package_app.py`
   - `src/services/sql/utils.py`
   - `backend_utils/launcher.py`

3. **Make sure Python is in the system PATH** (with any of the common names: python, python3, py)
   - The application will try to find the full absolute path of the Python executable in PATH

### How SQL Sage Finds Python (Script Mode Only)

The application will search for Python in this order:

1. Custom path in `python_config.json` (if present)
2. Hardcoded path (if it exists)
3. Common installation directories based on your operating system
4. Full absolute path of any Python executable found in system PATH
5. As a last resort, it will try to use just "python" and hope it works

## Troubleshooting (Script Mode Only)

### ENOENT (No such file or directory) Errors

If you see "spawn python ENOENT" errors, it means the application can't find the Python executable. This typically happens when:

1. The Python path is incorrect or doesn't exist
2. The Python executable is not in your system PATH
3. Python is installed but not properly configured

To fix this error:

1. Make sure Python is installed on your system
2. Create a `python_config.json` file with the full path to your Python executable
3. Add your Python installation directory to your system PATH
4. Use the PyInstaller packaged version which doesn't require Python

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
