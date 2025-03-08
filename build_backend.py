
import os
import sys
import shutil
import subprocess

def build_backend():
    """
    Instead of building the backend with PyInstaller, we'll just make sure
    the backend files are properly organized for packaging with Electron.
    """
    print("Preparing backend files for packaging...")
    
    # Get the current directory (should be frontend/sql-sage-py)
    current_dir = os.getcwd()
    
    # Go up one level to the parent directory (should be the 'frontend' directory)
    parent_dir = os.path.dirname(current_dir)
    
    # Go up one more level to the root project directory
    project_root = os.path.dirname(parent_dir)
    
    # Path to the actual backend directory
    source_backend_dir = os.path.join(project_root, "backend")
    
    print(f"Looking for backend directory at: {source_backend_dir}")
    
    # Create a local backend directory for packaging
    backend_dir = os.path.join(os.getcwd(), "backend")
    if not os.path.exists(backend_dir):
        os.makedirs(backend_dir)
    
    # Check if source backend directory exists
    if not os.path.exists(source_backend_dir):
        print(f"Warning: Backend directory not found at {source_backend_dir}")
        print("Attempting to find backend directory in alternative locations...")
        
        # Try other potential locations
        alternative_locations = [
            os.path.join(os.path.dirname(os.getcwd()), "backend"),  # frontend/backend
            os.path.join(os.getcwd(), "..", "..", "backend"),       # Alternative path format
            os.path.join(os.getcwd(), "..", "backend"),            # Another alternative
            os.path.abspath(os.path.join(os.getcwd(), "..", "..", "backend"))  # Absolute path
        ]
        
        for location in alternative_locations:
            print(f"Checking {location}...")
            if os.path.exists(location):
                source_backend_dir = location
                print(f"Found backend directory at: {source_backend_dir}")
                break
        else:
            print("ERROR: Could not find backend directory in any expected location.")
            print("Please make sure the backend directory exists and contains sql.py")
            return backend_dir
    
    # Copy all Python files and .env file from the backend directory
    backend_files = [f for f in os.listdir(source_backend_dir) if f.endswith('.py') or f == '.env']
    for file in backend_files:
        src_file = os.path.join(source_backend_dir, file)
        dest_file = os.path.join(backend_dir, file)
        shutil.copy2(src_file, dest_file)
        print(f"Copied {file} to local backend directory")
    
    # Copy requirements.txt if it exists
    req_file = os.path.join(source_backend_dir, "requirements.txt")
    if os.path.exists(req_file):
        shutil.copy2(req_file, os.path.join(backend_dir, "requirements.txt"))
        print("Copied requirements.txt to local backend directory")
    
    # Create a run_backend.py file which will be our entry point
    create_backend_launcher(backend_dir)
    
    print("Backend preparation complete!")
    return backend_dir

def create_backend_launcher(backend_dir):
    """Create a launcher script that will run sql.py"""
    backend_launcher = os.path.join(backend_dir, "run_backend.py")
    
    with open(backend_launcher, 'w') as f:
        f.write("""
import os
import sys
import subprocess

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
    print(f"Python path: {sys.path}")
    
    try:
        # Try to import required packages
        import uvicorn
        import fastapi
        print("Successfully imported required packages")
    except ImportError as e:
        print(f"Error importing required packages: {e}")
        print("Attempting to install missing packages...")
        try:
            # Check if requirements.txt exists
            req_file = os.path.join(script_dir, "requirements.txt")
            if os.path.exists(req_file):
                subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_file])
            else:
                # Install minimum required packages
                subprocess.check_call([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn", "pyodbc", "requests"])
            print("Package installation complete. Retrying import...")
            import uvicorn
            import fastapi
        except Exception as e:
            print(f"Failed to install required packages: {e}")
            sys.exit(1)
    
    # Check if sql.py exists in the current directory
    sql_path = os.path.join(script_dir, "sql.py")
    if not os.path.exists(sql_path):
        print(f"Error: sql.py not found at {sql_path}")
        sys.exit(1)
    
    print(f"Starting SQL Server API from {sql_path}...")
    
    # Import and run the sql.py script
    try:
        import sql
        print("SQL module imported successfully")
    except Exception as e:
        print(f"Error importing sql.py: {e}")
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

if __name__ == "__main__":
    build_backend()

