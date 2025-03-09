
# SQL Sage Python Path Configuration

This document explains how to configure the Python path for SQL Sage.

## Current Configuration

SQL Sage is currently configured to use the following Python path:

```
C:\Users\farha\anaconda3\envs\sqlbot\python.exe
```

This path is hardcoded in multiple files to ensure consistent Python execution across the application.

## If You Need to Change the Python Path

If you need to use a different Python environment, you'll need to update the path in the following files:

1. `backend_utils/environment.py`
2. `backend_utils/build.py`
3. `backend_utils/launcher.py`
4. `backend_utils/electron.py`
5. `backend_utils/package_app.py`
6. `src/services/sql/utils.py`

After updating these files, rebuild the application using:

```bash
python package_app.py
```

## Verifying Your Python Environment

To verify your Python environment is correctly configured:

1. Open a Command Prompt or PowerShell window
2. Run the following command with your Python path:
   ```
   "C:\Users\farha\anaconda3\envs\sqlbot\python.exe" --version
   ```
3. You should see a version number printed (e.g., "Python 3.8.5")
4. Verify required packages are installed:
   ```
   "C:\Users\farha\anaconda3\envs\sqlbot\python.exe" -c "import fastapi, uvicorn; print('OK')"
   ```

## Common Issues

### ENOENT (No such file or directory) Errors

If you see "spawn python ENOENT" errors, it means the application can't find the Python executable. This typically happens when:

1. The Python path is incorrect or doesn't exist
2. The application is looking for "python" instead of the full path
3. Path separators are inconsistent (mixing / and \)

### Package Import Errors

If you see "No module named 'X'" errors, you need to install the required packages in your Python environment:

```bash
"C:\Users\farha\anaconda3\envs\sqlbot\python.exe" -m pip install fastapi uvicorn pyodbc requests python-dotenv
```

## Troubleshooting Tips

1. Always use the absolute path to Python when calling it from scripts or configuration files
2. On Windows, use double quotes around paths to handle spaces in directory names
3. Check that the Python executable exists before using it
4. Verify the Python environment has all the required packages installed
