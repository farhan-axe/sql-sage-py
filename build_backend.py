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
    
    # Check specifically for the 'sqlbot' environment that user mentioned
    try:
        # Try to detect conda environments using conda command
        if platform.system() == "Windows":
            conda_cmd = "conda.exe"
        else:
            conda_cmd = "conda"
        
        result = subprocess.run([conda_cmd, "env", "list"], capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if 'sqlbot' in line:
                    env_path = line.split()[-1]  # Path is usually the last item
                    if platform.system() == "Windows":
                        python_path = os.path.join(env_path, "python.exe")
                    else:
                        python_path = os.path.join(env_path, "bin", "python")
                    
                    if os.path.exists(python_path):
                        print(f"Found sqlbot conda environment at: {env_path}")
                        print(f"Using Python executable: {python_path}")
                        return python_path
    except:
        print("Failed to detect conda environments via conda command")
    
    # Try specific known paths for the sqlbot environment
    if platform.system() == "Windows":
        known_paths = [
            os.path.expanduser("~/anaconda3/envs/sqlbot/python.exe"),
            os.path.expanduser("~/miniconda3/envs/sqlbot/python.exe"),
            "C:\\\\Users\\\\farha\\\\anaconda3\\\\envs\\\\sqlbot\\\\python.exe",  # Known path from user's environment
            "C:\\\\ProgramData\\Anaconda3\\envs\\sqlbot\\python.exe",
        ]
        
        for path in known_paths:
            if os.path.exists(path):
                print(f"Found sqlbot environment Python at: {path}")
                return path
    
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
    
    # We'll write the file content with explicit string concatenation to avoid f-string syntax errors
    launcher_content = """
import os
import sys
import subprocess
import platform
import time
import glob
import socket

# Hard-coded python path from build time
CONDA_PYTHON_PATH = """ + repr(python_path) + """

# List of potential conda Python paths with 'sqlbot' environment
POTENTIAL_CONDA_PATHS = [
    os.path.expanduser("~/anaconda3/envs/sqlbot/python.exe"),
    os.path.expanduser("~/miniconda3/envs/sqlbot/python.exe"),
    "C:\\\\Users\\\\farha\\\\anaconda3\\\\envs\\\\sqlbot\\\\python.exe",  # Known specific user path
    os.path.join(os.environ.get('USERPROFILE', ''), "anaconda3", "envs", "sqlbot", "python.exe"),
    os.path.join(os.environ.get('USERPROFILE', ''), "miniconda3", "envs", "sqlbot", "python.exe"),
] if platform.system() == "Windows" else [
    os.path.expanduser("~/anaconda3/envs/sqlbot/bin/python"),
    os.path.expanduser("~/miniconda3/envs/sqlbot/bin/python"),
    "/opt/anaconda3/envs/sqlbot/bin/python",
    "/opt/miniconda3/envs/sqlbot/bin/python",
]

def check_ollama_running(host="localhost", port=11434):
    """Check if Ollama server is running by attempting to connect to its port."""
    try:
        # Try to create a socket connection to the Ollama server
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)  # Set a timeout for the connection attempt
            result = s.connect_ex((host, port))
            return result == 0  # If result is 0, the connection was successful
    except:
        return False  # Any exception means Ollama is not accessible

def find_python_executable():
    """Find the Python executable to use."""
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
            
    # Try to get conda environments
    try:
        # Try to detect conda environments using conda command
        conda_cmd = "conda.exe" if platform.system() == "Windows" else "conda"
        result = subprocess.run([conda_cmd, "env", "list"], capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if 'sqlbot' in line:
                    env_path = line.split()[-1]  # Path is usually the last item
                    python_path = os.path.join(env_path, "python.exe" if platform.system() == "Windows" else "bin/python")
                    if os.path.exists(python_path):
                        print(f"Found conda Python from env list: {python_path}")
                        return python_path
    except:
        print("Failed to get conda environments via command")
    
    # Check our potential conda paths
    for path in POTENTIAL_CONDA_PATHS:
        if os.path.exists(path):
            print(f"Found Python at preset location: {path}")
            return path
    
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
        ]
    else:
        common_paths = [
            "/usr/bin/python3",
            "/usr/local/bin/python3",
            "/opt/homebrew/bin/python3",
            # Add conda paths
            os.path.expanduser("~/miniconda3/bin/python"),
            os.path.expanduser("~/anaconda3/bin/python"),
        ]
    
    for path in common_paths:
        if os.path.exists(path):
            print(f"Found Python at common location: {path}")
            return path
            
    # Look for Python in Program Files and other common locations
    if platform.system() == "Windows":
        python_glob_patterns = [
            "C:\\\\Python*\\\\python.exe",
            "C:\\\\Program Files\\\\Python*\\\\python.exe",
            "C:\\\\Program Files (x86)\\\\Python*\\\\python.exe",
            os.path.join(os.environ.get('LOCALAPPDATA', ''), "Programs", "Python", "Python*", "python.exe")
        ]
        
        for pattern in python_glob_patterns:
            matches = glob.glob(pattern)
            if matches:
                # Sort to get the latest version
                matches.sort(reverse=True)
                print(f"Found Python via glob: {matches[0]}")
                return matches[0]
    
    # As a last resort, try to use the python command directly
    try:
        # Check if 'python' or 'python3' exists in PATH
        cmd = "python" if platform.system() == "Windows" else "python3"
        result = subprocess.run([cmd, "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"Using system Python: {cmd}")
            return cmd
    except:
        pass
        
    # Absolute last resort
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
    print(f"Python paths checked:")
    for path in [CONDA_PYTHON_PATH] + POTENTIAL_CONDA_PATHS:
        print(f"  - {path}: {'EXISTS' if os.path.exists(path) else 'NOT FOUND'}")
    
    # Check if Ollama is running
    if not check_ollama_running():
        print("WARNING: Ollama service appears to be not running on the default port (11434).")
        print("The SQL Sage application requires Ollama to be running. Please start Ollama and try again.")
        
        # Write an error file that the main app can detect
        with open(os.path.join(script_dir, "ollama_not_running.err"), "w") as f:
            f.write("Ollama service is not running. Please start Ollama and restart the application.")
        
        # Return error code so the main app knows Ollama isn't running
        sys.exit(78)  # Custom error code to indicate Ollama not running
    else:
        print("Ollama service appears to be running.")
        # Remove error file if it exists
        if os.path.exists(os.path.join(script_dir, "ollama_not_running.err")):
            os.remove(os.path.join(script_dir, "ollama_not_running.err"))
    
    # Find the python executable
    python_exe = find_python_executable()
    print(f"Using Python executable: {python_exe}")
    
    # Create a simple test to validate Python works
    test_script = os.path.join(script_dir, "test_python.py")
    with open(test_script, 'w') as f:
        f.write("print('Python test successful!')\\n")
    
    try:
        # Test if Python is working
        print("Testing Python executable...")
        try:
            result = subprocess.run([python_exe, test_script], capture_output=True, text=True, timeout=5)
            print(f"Python test output: {result.stdout}")
            if result.returncode != 0:
                print(f"Python test error: {result.stderr}")
                print("Warning: Python test failed, but continuing anyway")
        except Exception as e:
            print(f"Python test error: {e}")
            print("Warning: Python test failed, but continuing anyway")
            # Try to find an alternative Python
            for alt_path in POTENTIAL_CONDA_PATHS:
                if os.path.exists(alt_path) and alt_path != python_exe:
                    print(f"Trying alternative Python: {alt_path}")
                    try:
                        result = subprocess.run([alt_path, test_script], capture_output=True, text=True, timeout=5)
                        if result.returncode == 0:
                            print(f"Alternative Python works! Using: {alt_path}")
                            python_exe = alt_path
                            break
                    except:
                        pass
    
        # First, check if necessary packages are installed
        print("Checking if required packages are installed...")
        check_cmd = [python_exe, "-c", "import fastapi, uvicorn; print('Packages are available')"]
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
            
            # On Windows, use the appropriate method to hide the console window
            startup_info = None
            if platform.system() == "Windows":
                startup_info = subprocess.STARTUPINFO()
                startup_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startup_info.wShowWindow = 0  # SW_HIDE
            
            process = subprocess.Popen(
                [python_exe, api_routes_path],
                startupinfo=startup_info,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait briefly to see if the process starts successfully
            time.sleep(2)
            if process.poll() is not None:
                # Process has already terminated
                stdout, stderr = process.communicate()
                print(f"Backend process failed to start. Return code: {process.returncode}")
                print(f"stdout: {stdout}")
                print(f"stderr: {stderr}")
                
                # Write an error file that the main app can detect
                with open(os.path.join(script_dir, "backend_start_failed.err"), "w") as f:
                    f.write(f"Backend process failed to start\\n\\nDetails:\\n{stderr}")
                
                sys.exit(1)
            else:
                print("Backend process started successfully")
            return
        
        # Check if sql.py exists as fallback
        sql_path = os.path.join(script_dir, "sql.py")
        if os.path.exists(sql_path):
            print(f"Starting backend using {sql_path}")
            
            # On Windows, use the appropriate method to hide the console window
            startup_info = None
            if platform.system() == "Windows":
                startup_info = subprocess.STARTUPINFO()
                startup_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startup_info.wShowWindow = 0  # SW_HIDE
            
            process = subprocess.Popen(
                [python_exe, sql_path],
                startupinfo=startup_info,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait briefly to see if the process starts successfully
            time.sleep(2)
            if process.poll() is not None:
                # Process has already terminated
                stdout, stderr = process.communicate()
                print(f"Backend process failed to start. Return code: {process.returncode}")
                print(f"stdout: {stdout}")
                print(f"stderr: {stderr}")
                
                # Write an error file that the main app can detect
                with open(os.path.join(script_dir, "backend_start_failed.err"), "w") as f:
                    f.write(f"Backend process failed to start\\n\\nDetails:\\n{stderr}")
                
                sys.exit(1)
            else:
                print("Backend process started successfully")
            return
        
        print("ERROR: Could not find api_routes.py or sql.py. Backend cannot start.")
        
        # Write an error file that the main app can detect
        with open(os.path.join(script_dir, "missing_backend_files.err"), "w") as f:
            f.write("Could not find api_routes.py or sql.py. Backend cannot start.")
        
        sys.exit(1)
        
    except Exception as e:
        print(f"Error starting backend: {e}")
        import traceback
        traceback.print_exc()
        
        # Write an error file that the main app can detect
        with open(os.path.join(script_dir, "backend_error.err"), "w") as f:
            f.write(f"Error starting backend: {e}\\n\\n{traceback.format_exc()}")
        
        sys.exit(1)

if __name__ == "__main__":
    run_backend()

if __name__ == "__main__":
    build_backend()
