
# SQL Sage Python Path Configuration

This document explains how to configure the Python path for SQL Sage.

## Current Configuration

SQL Sage is currently configured to try these Python paths in order:

1. The hardcoded path: `C:\Users\farha\anaconda3\envs\sqlbot\python.exe`
2. System Python available in PATH: `python`, `python3`, or `py`
3. Common Python installation locations based on your operating system

## If You Need to Change the Python Path

If you need to use a specific Python environment, you have these options:

1. **Modify the hardcoded path** in these files:
   - `backend_utils/environment.py`
   - `backend_utils/build.py`
   - `backend_utils/launcher.py`
   - `backend_utils/electron.py`
   - `backend_utils/package_app.py`
   - `src/services/sql/utils.py`

2. **Let SQL Sage auto-detect Python** from your PATH (recommended)
   - Make sure the Python you want to use is in your system PATH
   - The application will automatically find and use it

3. **Create a python_config.json file** in the application directory with:
   ```json
   {
     "python_path": "C:\\path\\to\\your\\python.exe"
   }
   ```

After updating these files, rebuild the application using:

```bash
python package_app.py
```

## Verifying Your Python Environment

To verify your Python environment is correctly configured:

1. Open a Command Prompt or PowerShell window
2. Run: `python --version`
3. You should see a version number printed (e.g., "Python 3.8.5")
4. Verify required packages are installed:
   ```
   python -c "import fastapi, uvicorn; print('OK')"
   ```

## Common Issues

### ENOENT (No such file or directory) Errors

If you see "spawn python ENOENT" errors, it means the application can't find the Python executable. This typically happens when:

1. The Python path is incorrect or doesn't exist
2. The Python executable is not in your system PATH
3. Python is installed but not properly configured

### How SQL Sage Finds Python

The application will search for Python in this order:

1. Hardcoded path (if it exists)
2. System PATH (using commands like "python", "python3", "py")
3. Common installation directories based on your operating system
4. As a last resort, it will try to use just "python" and hope it works

### Package Import Errors

If you see "No module named 'X'" errors, you need to install the required packages in your Python environment:

```bash
python -m pip install fastapi uvicorn pyodbc requests python-dotenv
```

## Troubleshooting Tips

1. Make sure Python is installed and accessible from the command line
2. On Windows, ensure Python is added to PATH during installation
3. Check that the Python environment has all required packages installed
4. Look for error files in the backend directory for more detailed error messages
5. If you see permission errors, try running the application as administrator

