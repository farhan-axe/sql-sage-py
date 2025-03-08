
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
    
    # User-specified path - check first based on error message
    user_specified = os.path.join(os.path.dirname(current_dir), "..", "backend")
    if os.path.exists(os.path.join(user_specified, "sql.py")):
        print(f"Found backend at user-specified location: {user_specified}")
        return user_specified
    
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
        
        # Another possible location mentioned by user
        os.path.abspath(os.path.join(os.path.dirname(current_dir), "..", "sqlbot", "backend")),
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

def detect_conda_environment():
    """Detect if we're running in a conda environment and get the python executable path."""
    # Check if we're in a conda environment
    conda_prefix = os.environ.get('CONDA_PREFIX')
    if conda_prefix:
        print(f"Detected conda environment: {conda_prefix}")
        # Get the python executable path within the conda environment
        if platform.system() == "Windows":
            python_exe = os.path.join(conda_prefix, "python.exe")
        else:
            python_exe = os.path.join(conda_prefix, "bin", "python")
        
        if os.path.exists(python_exe):
            print(f"Found conda Python executable: {python_exe}")
            return python_exe
    
    # If we're not in a conda environment or couldn't find the python executable
    print(f"Using system Python: {sys.executable}")
    return sys.executable

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
    else:
        # Create a requirements.txt if it doesn't exist
        with open(os.path.join(backend_dir, "requirements.txt"), 'w') as f:
            f.write("fastapi>=0.68.0\nuvicorn>=0.15.0\npyodbc>=4.0.32\npython-dotenv>=0.19.1\nrequests>=2.26.0\n")
        print("Created requirements.txt file")
    
    # Create a .env file if it doesn't exist
    env_file = os.path.join(backend_dir, ".env")
    if not os.path.exists(env_file):
        with open(env_file, 'w') as f:
            f.write("# Default configuration\nMODEL=deepseek-r1:8b\nPORT=5000\n")
        print("Created .env file")
    
    # Detect conda environment python path
    python_path = detect_conda_environment()
    
    # Create a run_backend.py file which will be our entry point
    create_backend_launcher(backend_dir, python_path=python_path)
    
    print("Backend preparation complete!")
    return backend_dir

def create_backend_launcher(backend_dir, has_source=True, python_path=None):
    """Create a launcher script that will run sql.py"""
    backend_launcher = os.path.join(backend_dir, "run_backend.py")
    
    # Get the python path - use the detected one or sys.executable as fallback
    if not python_path:
        python_path = sys.executable
    
    with open(backend_launcher, 'w') as f:
        f.write("""
import os
import sys
import subprocess
import platform
import time

# Hard-coded python path from build time
CONDA_PYTHON_PATH = """ + repr(python_path) + """

def find_python_executable():
    \"\"\"Find the Python executable to use.\"\"\"
    # First try the hard-coded path from build time
    if os.path.exists(CONDA_PYTHON_PATH):
        print(f"Using conda Python: {CONDA_PYTHON_PATH}")
        return CONDA_PYTHON_PATH
    
    # Check if we're running in a conda environment
    conda_prefix = os.environ.get('CONDA_PREFIX')
    if conda_prefix:
        if platform.system() == "Windows":
            conda_python = os.path.join(conda_prefix, "python.exe")
        else:
            conda_python = os.path.join(conda_prefix, "bin", "python")
        
        if os.path.exists(conda_python):
            print(f"Found conda Python: {conda_python}")
            return conda_python
    
    # Check common locations for Python
    if platform.system() == "Windows":
        common_paths = [
            r"C:\\Python39\\python.exe",
            r"C:\\Python310\\python.exe",
            r"C:\\Program Files\\Python39\\python.exe",
            r"C:\\Program Files\\Python310\\python.exe",
            r"C:\\Program Files (x86)\\Python39\\python.exe",
            r"C:\\Program Files (x86)\\Python310\\python.exe",
            # Add conda paths
            os.path.expanduser(r"~\\miniconda3\\python.exe"),
            os.path.expanduser(r"~\\anaconda3\\python.exe"),
            os.path.expanduser(r"~\\miniconda3\\envs\\sqlbot\\python.exe"),
            os.path.expanduser(r"~\\anaconda3\\envs\\sqlbot\\python.exe"),
        ]
    else:
        common_paths = [
            "/usr/bin/python3",
            "/usr/local/bin/python3",
            "/opt/homebrew/bin/python3",
            # Add conda paths
            os.path.expanduser("~/miniconda3/bin/python"),
            os.path.expanduser("~/anaconda3/bin/python"),
            os.path.expanduser("~/miniconda3/envs/sqlbot/bin/python"),
            os.path.expanduser("~/anaconda3/envs/sqlbot/bin/python"),
        ]
    
    for path in common_paths:
        if os.path.exists(path):
            print(f"Found Python at common location: {path}")
            return path
    
    # As a last resort, use the system's python (which may fail)
    print("Using system Python as fallback")
    return "python" if platform.system() == "Windows" else "python3"

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
    print(f"System platform: {platform.platform()}")
    
    # Find the python executable
    python_exe = find_python_executable()
    print(f"Using Python executable: {python_exe}")
    
    try:
        # First, check if necessary packages are installed
        print("Checking if required packages are installed...")
        check_cmd = [python_exe, "-c", "import fastapi, uvicorn, pyodbc; print('Packages are available')"]
        try:
            output = subprocess.check_output(check_cmd, stderr=subprocess.STDOUT, universal_newlines=True)
            print(output)
            packages_installed = True
        except subprocess.CalledProcessError as e:
            print(f"Error checking packages: {e.output}")
            packages_installed = False
        
        if not packages_installed:
            print("Installing required packages...")
            # Check if requirements.txt exists
            req_file = os.path.join(script_dir, "requirements.txt")
            if os.path.exists(req_file):
                print(f"Installing packages from {req_file}")
                subprocess.check_call([python_exe, "-m", "pip", "install", "-r", req_file])
            else:
                # Install minimum required packages
                print("Installing minimum required packages")
                subprocess.check_call([python_exe, "-m", "pip", "install", "fastapi", "uvicorn", "pyodbc", "requests", "python-dotenv"])
        
        # Check if api_routes.py exists
        api_routes_path = os.path.join(script_dir, "api_routes.py")
        if os.path.exists(api_routes_path):
            print(f"Starting backend using {api_routes_path}")
            subprocess.Popen([python_exe, api_routes_path])
            return
        
        # Check if sql.py exists as fallback
        sql_path = os.path.join(script_dir, "sql.py")
        if os.path.exists(sql_path):
            print(f"Starting backend using {sql_path}")
            subprocess.Popen([python_exe, sql_path])
            return
        
        print("ERROR: Could not find api_routes.py or sql.py. Backend cannot start.")
        
    except Exception as e:
        print(f"Error starting backend: {e}")
        import traceback
        traceback.print_exc()

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

if __name__ == "__main__":
    build_backend()
