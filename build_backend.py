
import os
import sys
import shutil
import subprocess
import platform

def find_backend_directory():
    """Search for the backend directory in various locations."""
    # Get the current directory (should be frontend/sql-sage-py)
    current_dir = os.getcwd()
    print(f"Current directory: {current_dir}")
    
    # Try various potential locations for the backend
    potential_locations = [
        # Current directory / backend
        os.path.join(current_dir, "backend"),
        
        # Parent directory (frontend) / backend
        os.path.join(os.path.dirname(current_dir), "backend"),
        
        # Grandparent directory (project root) / backend
        os.path.join(os.path.dirname(os.path.dirname(current_dir)), "backend"),
        
        # One more level up / backend (in case of deeply nested structure)
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))), "backend"),
        
        # Explicit path with 'sqlbot' in it (based on error message)
        os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(current_dir)), "..", "backend")),
        
        # Even more specific path based on user message
        os.path.abspath(os.path.join(current_dir, "..", "..", "..", "backend")),
    ]
    
    # Print all paths we're going to check
    print("Searching for backend directory in these locations:")
    for idx, location in enumerate(potential_locations):
        print(f"  {idx+1}. {location}")
    
    # Check each location
    for location in potential_locations:
        if os.path.exists(location):
            # Check if this directory has sql.py to confirm it's the backend
            if os.path.exists(os.path.join(location, "sql.py")):
                print(f"Found backend directory at: {location}")
                return location
            else:
                print(f"Directory exists but doesn't contain sql.py: {location}")
    
    # If a specific path was mentioned by the user, try to handle that
    if os.path.exists(os.path.join(os.path.dirname(os.path.dirname(current_dir)), "..", "sqlbot", "backend")):
        backend_dir = os.path.join(os.path.dirname(os.path.dirname(current_dir)), "..", "sqlbot", "backend")
        print(f"Found backend at user-specified location: {backend_dir}")
        return backend_dir
    
    # Try by asking the user for the path (if this is an interactive session)
    if hasattr(sys, 'ps1') or sys.stdout.isatty():
        print("\nCould not automatically find the backend directory.")
        user_path = input("Please enter the full path to the backend directory: ")
        if os.path.exists(user_path) and os.path.exists(os.path.join(user_path, "sql.py")):
            print(f"Using user-provided backend path: {user_path}")
            return user_path
    
    print("\nWARNING: Could not find backend directory. Please make sure it exists and contains sql.py")
    print("The application may not function correctly without the backend files.")
    
    # Return None if we can't find it
    return None

def build_backend():
    """
    Instead of building the backend with PyInstaller, we'll just make sure
    the backend files are properly organized for packaging with Electron.
    """
    print("Preparing backend files for packaging...")
    
    # Create a local backend directory for packaging
    backend_dir = os.path.join(os.getcwd(), "backend")
    if not os.path.exists(backend_dir):
        os.makedirs(backend_dir)
    
    # Find the backend directory
    source_backend_dir = find_backend_directory()
    
    if not source_backend_dir:
        print("ERROR: Backend directory not found. Creating an empty backend directory.")
        print("The application will need a proper backend to function.")
        create_backend_launcher(backend_dir, has_source=False)
        return backend_dir
    
    # Copy all Python files and .env file from the backend directory
    files_to_copy = [f for f in os.listdir(source_backend_dir) 
                    if f.endswith('.py') or f == '.env' or f.endswith('.json')]
    
    for file in files_to_copy:
        src_file = os.path.join(source_backend_dir, file)
        dest_file = os.path.join(backend_dir, file)
        try:
            shutil.copy2(src_file, dest_file)
            print(f"Copied {file} to local backend directory")
        except Exception as e:
            print(f"Error copying {file}: {e}")
    
    # Copy requirements.txt if it exists
    req_file = os.path.join(source_backend_dir, "requirements.txt")
    if os.path.exists(req_file):
        shutil.copy2(req_file, os.path.join(backend_dir, "requirements.txt"))
        print("Copied requirements.txt to local backend directory")
    
    # Create a run_backend.py file which will be our entry point
    create_backend_launcher(backend_dir)
    
    print("Backend preparation complete!")
    return backend_dir

def create_backend_launcher(backend_dir, has_source=True):
    """Create a launcher script that will run sql.py"""
    backend_launcher = os.path.join(backend_dir, "run_backend.py")
    
    with open(backend_launcher, 'w') as f:
        f.write("""
import os
import sys
import subprocess
import platform
import time

def run_backend():
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Add the script directory to Python's path
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    
    # Change to the script directory
    os.chdir(script_dir)
    
    # Print diagnostic information
    print(f"Working directory: {os.getcwd()}")
    print(f"Python executable: {sys.executable}")
    print(f"Python version: {sys.version}")
    print(f"System platform: {platform.platform()}")
    print(f"Python path: {sys.path}")
    
    try:
        # Try to import required packages
        import uvicorn
        import fastapi
        import pyodbc
        print("Successfully imported required packages")
    except ImportError as e:
        print(f"Error importing required packages: {e}")
        print("Attempting to install missing packages...")
        try:
            # Check if requirements.txt exists
            req_file = os.path.join(script_dir, "requirements.txt")
            if os.path.exists(req_file):
                print(f"Installing packages from {req_file}")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_file])
            else:
                # Install minimum required packages
                print("Installing minimum required packages")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn", "pyodbc", "requests", "python-dotenv"])
            
            # Wait a moment for installation to complete
            time.sleep(2)
            
            print("Package installation complete. Retrying import...")
            import uvicorn
            import fastapi
            import pyodbc
        except Exception as e:
            print(f"Failed to install required packages: {e}")
            sys.exit(1)
    
    # Check if sql.py exists in the current directory
    sql_path = os.path.join(script_dir, "sql.py")
    if not os.path.exists(sql_path):
        print(f"Error: sql.py not found at {sql_path}")
        print(f"Contents of {script_dir}:")
        print(os.listdir(script_dir))
        sys.exit(1)
    
    print(f"Starting SQL Server API from {sql_path}...")
    
    # Import and run the sql.py script
    try:
        # Try to import API from api_routes.py if it exists
        api_routes_path = os.path.join(script_dir, "api_routes.py")
        if os.path.exists(api_routes_path):
            print("Found api_routes.py, importing app")
            sys.path.insert(0, script_dir)
            from api_routes import app
            print("Starting Uvicorn server with API...")
            import uvicorn
            uvicorn.run(app, host="127.0.0.1", port=5000)
        else:
            # Otherwise import sql.py
            print("Importing sql module")
            import sql
            print("SQL module imported successfully")
    except Exception as e:
        print(f"Error importing modules: {e}")
        # If import fails, try running it as a subprocess
        try:
            print("Attempting to run sql.py as a subprocess...")
            subprocess.call([sys.executable, sql_path])
        except Exception as e:
            print(f"Error running sql.py as subprocess: {e}")
            sys.exit(1)

if __name__ == "__main__":
    run_backend()
""")
    
    print(f"Created backend launcher script at {backend_launcher}")
    
    # If no source backend was found, create a placeholder sql.py
    if not has_source:
        placeholder_sql = os.path.join(backend_dir, "sql.py")
        with open(placeholder_sql, 'w') as f:
            f.write("""
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Set up logging
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Create a FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "SQL Sage Backend API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/sql/connect")
async def connect_placeholder():
    return {"status": "error", "message": "Placeholder backend - actual backend not found during packaging"}

if __name__ == "__main__":
    logger.info("Starting SQL Sage backend server")
    uvicorn.run(app, host="127.0.0.1", port=5000)
""")
        print("Created placeholder sql.py file")
        
        # Create requirements.txt
        with open(os.path.join(backend_dir, "requirements.txt"), 'w') as f:
            f.write("fastapi>=0.68.0\nuvicorn>=0.15.0\npyodbc>=4.0.32\npython-dotenv>=0.19.1\nrequests>=2.26.0\n")
        print("Created requirements.txt file")
        
        # Create .env
        with open(os.path.join(backend_dir, ".env"), 'w') as f:
            f.write("# Default configuration\nMODEL=deepseek-r1:8b\nPORT=5000\n")
        print("Created .env file")

if __name__ == "__main__":
    build_backend()
