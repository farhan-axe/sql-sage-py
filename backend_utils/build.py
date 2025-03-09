
import os
import shutil
from .path_finder import find_backend_directory
from .environment import detect_conda_environment, find_python_executable
from .launcher import create_backend_launcher

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
    
    # Always use only the hardcoded Python path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using hardcoded Python path: {hardcoded_python_path}")
    
    # Create a run_backend.py file which will be our entry point
    create_backend_launcher(backend_dir, python_path=hardcoded_python_path)
    
    print("Backend preparation complete!")
    return backend_dir
