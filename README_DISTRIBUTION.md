
# SQL Sage Distribution Guide

This guide explains how to package SQL Sage for distribution to end users.

## Prerequisites

Before packaging:

1. Make sure your development environment is set up correctly
2. Make sure Python (3.8 or higher) is installed and accessible from the command line
3. Install Node.js and npm (if not already installed)
4. Install PyInstaller if you want to create a standalone executable (recommended):
   ```bash
   pip install pyinstaller
   ```

## Packaging Steps

### Option 1: Automated Packaging (Recommended)

Run the packaging script which will build everything automatically:

```bash
python package_app.py
```

The packaged application will be available in the `final_package/SQL Sage` directory.

### Option 2: Manual Packaging

If you prefer to package manually or the automated script fails:

1. **Build the backend:**
   ```bash
   python build_backend.py
   ```

2. **Build the frontend:**
   ```bash
   npm run build
   ```

3. **Setup Electron:**
   - Copy `electron-package.json` to `package.json`
   - Create a `backend` directory and copy the backend executable there
   - Copy the `.env` file to the backend directory

4. **Build the Electron app:**
   ```bash
   npm install --save-dev electron electron-builder
   npx electron-builder --dir
   ```

5. **Create the final package:**
   - Copy the Electron app from `electron-dist` to your distribution folder
   - Include the `DIST_README.md` and `OLLAMA_SETUP.txt` instructions

## Distribution to End Users

When distributing SQL Sage to end users:

1. Share the entire `SQL Sage` folder from the `final_package` directory
2. Include the `DIST_README.md` and `OLLAMA_SETUP.txt` files
3. Make sure users know they need to install:
   - SQL Server ODBC Driver 17
   - Ollama with the DeepSeek model

**NEW:** With the PyInstaller package, users no longer need to have Python installed!

## Backend Packaging Methods

SQL Sage now supports two packaging methods for the backend:

1. **PyInstaller (recommended):**
   - Creates a standalone executable that doesn't require Python
   - Works on the user's machine without Python installation
   - Results in a larger package but easier setup

2. **Python Script (fallback):**
   - Used if PyInstaller fails or is not installed
   - Requires the user to have Python installed
   - Backend script always tries to use the full absolute path to Python, never just 'python'

The packaging script automatically tries to use PyInstaller first, falling back to the Python script method if necessary.

## Troubleshooting Backend Startup Issues

If the backend closes immediately after launch:

1. **Run the backend manually:**
   - Open a command prompt/terminal
   - Navigate to the backend directory
   - Run `run_backend.bat` (Windows) or `python run_backend.py` (Mac/Linux)
   - This will show any error messages in the console

2. **Check for error files:**
   - Look in the backend directory for files ending with `.err`
   - These contain error information that can help diagnose issues

3. **Common backend startup issues:**
   - **Missing dependencies:** The executable might be missing required DLLs
   - **Ollama not running:** The backend requires Ollama to be running
   - **Port conflict:** Another application might be using port 3001 or 5000
   - **Antivirus interference:** Some antivirus software might block the executable

4. **For the Python script method:**
   - Make sure Python is installed
   - Check if all required packages are installed
   - Create a `python_config.json` file with the absolute path to your Python executable

## Python Path Handling

When using the Python script method (fallback), the application:

1. First checks for a custom path in `python_config.json`
2. Then tries the hardcoded Python path
3. Searches common installation locations
4. Looks for Python in the system PATH, but gets its full absolute path
5. Only as a last resort uses the command 'python'

This approach minimizes the risk of "spawn python ENOENT" errors that occur when the system can't find the Python executable.

## Testing Your Package

Before distributing:

1. Test the package on a system without your development environment
2. Make sure all dependencies are properly included
3. If using the Python script method, verify that Python detection works correctly
4. Check that Ollama integration functions properly
5. Test a sample SQL query to ensure the backend is working correctly
