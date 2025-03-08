
# SQL Sage Distribution Guide

This guide explains how to package SQL Sage for distribution to end users.

## Prerequisites

Before packaging:

1. Make sure your development environment is set up correctly
2. Install PyInstaller: `pip install pyinstaller`
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

## Customization

To customize the packaged application:

- Edit `.env` to change the default model or port
- Modify `electron.js` for Electron-specific settings
- Update `sql_sage.spec` for PyInstaller configurations

## Troubleshooting

- If packaging fails with missing dependencies, add them to the spec file
- For platform-specific issues, see PyInstaller and Electron-builder documentation
- Test your packaging on the same OS platform you're targeting for distribution
