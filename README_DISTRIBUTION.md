
# SQL Sage Distribution Guide

This guide explains how to package SQL Sage for distribution to end users.

## Prerequisites

Before packaging:

1. Make sure your development environment is set up correctly
2. Make sure Python (3.8 or higher) is installed and accessible from the command line
3. Install Node.js and npm (if not already installed)

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
   - Include the `OLLAMA_SETUP.txt` instructions

## Distribution to End Users

When distributing SQL Sage to end users:

1. Share the entire `SQL Sage` folder from the `final_package` directory
2. Include the `DIST_README.md` and `OLLAMA_SETUP.txt` files
3. Make sure users know they need to install:
   - SQL Server ODBC Driver 17
   - Ollama with the DeepSeek model
   - Python 3.8 or higher

## How SQL Sage Finds Python

The application is now smarter about finding Python:

1. It first tries a hardcoded path from your development environment 
2. If that fails, it looks for Python in the system PATH
3. If Python still isn't found, it checks common installation locations
4. As a last resort, it tries the basic "python" command

This means users don't need to have Python installed at the exact same path as your development environment.

## Customization

To customize the packaged application:

- Edit `.env` to change the default model or port
- Modify `electron.js` for Electron-specific settings
- If you need to use a specific Python path, you can create a `python_config.json` file with:
  ```json
  {
    "python_path": "C:\\path\\to\\your\\python.exe"
  }
  ```

## Troubleshooting

- If packaging fails with missing dependencies, add them to the requirements.txt file
- For users experiencing "ENOENT" errors, make sure they have Python installed and it's in their PATH
- The start_sql_sage.bat script includes detailed Python detection and will show which Python it found
- For Ollama connection issues, check the setup instructions in OLLAMA_SETUP.txt

## Testing Your Package

Before distributing:

1. Test the package on a system without your development environment
2. Make sure all dependencies are properly included
3. Verify that Python detection works correctly
4. Check that Ollama integration functions properly
5. Test a sample SQL query to ensure the backend is working correctly

