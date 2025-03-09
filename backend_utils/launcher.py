
import os
import platform
import time
from .ollama import check_ollama_running

def create_backend_launcher(backend_dir, has_source=True, python_path=None):
    """Create a launcher script that will run sql.py"""
    backend_launcher = os.path.join(backend_dir, "run_backend.py")
    
    # Get the python path - use the detected one or sys.executable as fallback
    if not python_path:
        import sys
        python_path = sys.executable
    
    # FIX: Normalize the path to use proper path separators
    python_path = os.path.normpath(python_path)
    
    # Define potential conda paths for later use in the launcher script
    potential_conda_paths = []
    if platform.system() == "Windows":
        potential_conda_paths = [
            os.path.normpath(os.path.expanduser("~/anaconda3/envs/sqlbot/python.exe")),
            os.path.normpath(os.path.expanduser("~/miniconda3/envs/sqlbot/python.exe")),
            os.path.normpath("C:\\Users\\farha\\anaconda3\\envs\\sqlbot\\python.exe"),
            os.path.normpath(os.path.join(os.environ.get('USERPROFILE', ''), "anaconda3", "envs", "sqlbot", "python.exe")),
            os.path.normpath(os.path.join(os.environ.get('USERPROFILE', ''), "miniconda3", "envs", "sqlbot", "python.exe"))
        ]
    else:
        potential_conda_paths = [
            os.path.normpath(os.path.expanduser("~/anaconda3/envs/sqlbot/bin/python")),
            os.path.normpath(os.path.expanduser("~/miniconda3/envs/sqlbot/bin/python")),
            os.path.normpath("/opt/anaconda3/envs/sqlbot/bin/python"),
            os.path.normpath("/opt/miniconda3/envs/sqlbot/bin/python")
        ]
    
    # Write the launcher script content
    launcher_content = f"""
import os
import sys
import subprocess
import platform
import time
import glob
import socket

# Hard-coded python path from build time
CONDA_PYTHON_PATH = {repr(python_path)}

# List of potential conda Python paths with 'sqlbot' environment
POTENTIAL_CONDA_PATHS = {repr(potential_conda_paths)}

def check_ollama_running(host="localhost", port=11434):
    \"\"\"Check if Ollama server is running by attempting to connect to its port.\"\"\"
    try:
        # Try to create a socket connection to the Ollama server
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)  # Set a timeout for the connection attempt
            result = s.connect_ex((host, port))
            return result == 0  # If result is 0, the connection was successful
    except:
        return False  # Any exception means Ollama is not accessible

def find_python_executable():
    \"\"\"Find the Python executable to use.\"\"\"
    # First try the hard-coded path from build time
    if os.path.exists(CONDA_PYTHON_PATH):
        print(f"Using conda Python: {{CONDA_PYTHON_PATH}}")
        return CONDA_PYTHON_PATH
    
    # Check if we're running in a conda environment
    conda_prefix = os.environ.get('CONDA_PREFIX')
    if conda_prefix:
        if platform.system() == "Windows":
            conda_python = os.path.join(conda_prefix, "python.exe")
        else:
            conda_python = os.path.join(conda_prefix, "bin", "python")
        
        if os.path.exists(conda_python):
            print(f"Found conda Python: {{conda_python}}")
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
                        print(f"Found conda Python from env list: {{python_path}}")
                        return python_path
    except:
        print("Failed to get conda environments via command")
    
    # Check our potential conda paths
    for path in POTENTIAL_CONDA_PATHS:
        if os.path.exists(path):
            print(f"Found Python at preset location: {{path}}")
            return path
    
    # Check system PATH python locations
    python_cmds = ["python", "python3"]
    if platform.system() == "Windows":
        python_cmds = ["python.exe", "py"]
    
    for cmd in python_cmds:
        try:
            result = subprocess.run([cmd, "--version"], 
                                  capture_output=True, 
                                  text=True)
            if result.returncode == 0:
                print(f"Found Python in PATH: {{cmd}}")
                return cmd
        except FileNotFoundError:
            continue
    
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
            print(f"Found Python at common location: {{path}}")
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
                print(f"Found Python via glob: {{matches[0]}}")
                return matches[0]
    
    # As a last resort, try to use the python command directly
    return "python" if platform.system() == "Windows" else "python3"

def run_backend():
    \"\"\"Run the backend server using the found Python executable.\"\"\"
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Add the script directory to Python's path
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    
    # Change to the script directory
    os.chdir(script_dir)
    
    # Print diagnostic information
    print(f"Working directory: {{os.getcwd()}}")
    print(f"System platform: {{platform.platform()}}")
    print("Python paths checked:")
    
    # Fixed path iteration - iterate through our defined list of paths
    for path in [CONDA_PYTHON_PATH] + POTENTIAL_CONDA_PATHS:
        print(f"  - {{path}}: {'EXISTS' if os.path.exists(path) else 'NOT FOUND'}")

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
    print(f"Using Python executable: {{python_exe}}")
    
    # Create a simple test to validate Python works
    test_script = os.path.join(script_dir, "test_python.py")
    with open(test_script, 'w') as f:
        f.write("print('Python test successful!')")
    
    try:
        # Test if Python is working
        print("Testing Python executable...")
        try:
            result = subprocess.run([python_exe, test_script], capture_output=True, text=True, timeout=5)
            print(f"Python test output: {{result.stdout}}")
            if result.returncode != 0:
                print(f"Python test error: {{result.stderr}}")
                print("Warning: Python test failed, but continuing anyway")
        except Exception as e:
            print(f"Python test error: {{e}}")
            print("Warning: Python test failed, but continuing anyway")
            # Try to find an alternative Python
            for alt_path in POTENTIAL_CONDA_PATHS:
                if os.path.exists(alt_path) and alt_path != python_exe:
                    print(f"Trying alternative Python: {{alt_path}}")
                    try:
                        result = subprocess.run([alt_path, test_script], capture_output=True, text=True, timeout=5)
                        if result.returncode == 0:
                            print(f"Alternative Python works! Using: {{alt_path}}")
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
            print(f"Error checking packages: {{e.output}}")
            packages_installed = False
        
        if not packages_installed:
            print("Installing required packages...")
            # Check if requirements.txt exists
            req_file = os.path.join(script_dir, "requirements.txt")
            if os.path.exists(req_file):
                print(f"Installing packages from {{req_file}}")
                subprocess.check_call([python_exe, "-m", "pip", "install", "-r", req_file])
            else:
                # Install minimum required packages
                print("Installing minimum required packages")
                subprocess.check_call([python_exe, "-m", "pip", "install", "fastapi", "uvicorn", "pyodbc", "requests", "python-dotenv"])
        
        # Check if api_routes.py exists
        api_routes_path = os.path.join(script_dir, "api_routes.py")
        if os.path.exists(api_routes_path):
            print(f"Starting backend using {{api_routes_path}}")
            
            # On Windows, use the appropriate method to hide the console window
            # but don't do this for debugging as we want to see output
            startup_info = None
            if platform.system() == "Windows":
                startup_info = subprocess.STARTUPINFO()
                startup_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startup_info.wShowWindow = 0  # SW_HIDE
            
            # Use shell=True on Windows to make sure the python command is found
            use_shell = platform.system() == "Windows"
            
            # Build command with full paths to be safer
            if os.path.isabs(python_exe):
                cmd = [python_exe, api_routes_path]
            else:
                # For Python commands like "python" or "python3" 
                # Use shell=True to let the system find them
                cmd = f"{{python_exe}} {{api_routes_path}}" if use_shell else [python_exe, api_routes_path]
            
            print(f"Executing command: {{cmd}}")
            
            # Create a .bat file on Windows as an alternative method
            if platform.system() == "Windows" and not os.path.isabs(python_exe):
                bat_path = os.path.join(script_dir, "run_api.bat")
                with open(bat_path, 'w') as f:
                    f.write(f"@echo off\\n")
                    f.write(f"echo Starting SQL Sage API...\\n")
                    f.write(f"{{python_exe}} {{api_routes_path}}\\n")
                print(f"Created batch file: {{bat_path}}")
                cmd = bat_path
                use_shell = True
            
            # Create a .bat file on Windows with ABSOLUTE path for more reliable execution
            if platform.system() == "Windows" and os.path.isabs(python_exe):
                bat_path = os.path.join(script_dir, "run_api_absolute.bat")
                with open(bat_path, 'w') as f:
                    f.write("@echo off\\n")
                    f.write("echo Starting SQL Sage API with absolute path...\\n")
                    # Use double quotes around paths to handle spaces
                    f.write(f"\\"{{python_exe}}\\" \\"{{api_routes_path}}\\"\\n")
                print(f"Created batch file with absolute paths: {{bat_path}}")
                # Use this as our command instead
                cmd = bat_path
                use_shell = True
            
            # Start the process
            process = subprocess.Popen(
                cmd,
                shell=use_shell,
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
                print(f"Backend process failed to start. Return code: {{process.returncode}}")
                print(f"stdout: {{stdout}}")
                print(f"stderr: {{stderr}}")
                
                # Write an error file that the main app can detect
                with open(os.path.join(script_dir, "backend_start_failed.err"), "w") as f:
                    f.write(f"Backend process failed to start\\n\\nDetails:\\n{{stderr}}")
                
                sys.exit(1)
            else:
                print("Backend process started successfully")
            return
        
        # Check if sql.py exists as fallback
        sql_path = os.path.join(script_dir, "sql.py")
        if os.path.exists(sql_path):
            print(f"Starting backend using {{sql_path}}")
            
            # Similar approach as above, just with sql.py
            startup_info = None
            if platform.system() == "Windows":
                startup_info = subprocess.STARTUPINFO()
                startup_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startup_info.wShowWindow = 0  # SW_HIDE
            
            # Use shell=True on Windows
            use_shell = platform.system() == "Windows"
            
            # Build command
            if os.path.isabs(python_exe):
                cmd = [python_exe, sql_path]
            else:
                cmd = f"{{python_exe}} {{sql_path}}" if use_shell else [python_exe, sql_path]
            
            # Create a .bat file on Windows
            if platform.system() == "Windows" and not os.path.isabs(python_exe):
                bat_path = os.path.join(script_dir, "run_sql.bat")
                with open(bat_path, 'w') as f:
                    f.write(f"@echo off\\n")
                    f.write(f"echo Starting SQL Sage API (sql.py)...\\n")
                    f.write(f"{{python_exe}} {{sql_path}}\\n")
                print(f"Created batch file: {{bat_path}}")
                cmd = bat_path
                use_shell = True
            
            # Create a .bat file on Windows with ABSOLUTE path for more reliable execution
            if platform.system() == "Windows" and os.path.isabs(python_exe):
                bat_path = os.path.join(script_dir, "run_sql_absolute.bat")
                with open(bat_path, 'w') as f:
                    f.write("@echo off\\n")
                    f.write("echo Starting SQL Sage API (sql.py) with absolute path...\\n")
                    # Use double quotes around paths to handle spaces
                    f.write(f"\\"{{python_exe}}\\" \\"{{sql_path}}\\"\\n")
                print(f"Created batch file with absolute paths: {{bat_path}}")
                # Use this as our command instead
                cmd = bat_path
                use_shell = True
            
            process = subprocess.Popen(
                cmd,
                shell=use_shell,
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
                print(f"Backend process failed to start. Return code: {{process.returncode}}")
                print(f"stdout: {{stdout}}")
                print(f"stderr: {{stderr}}")
                
                # Write an error file that the main app can detect
                with open(os.path.join(script_dir, "backend_start_failed.err"), "w") as f:
                    f.write(f"Backend process failed to start\\n\\nDetails:\\n{{stderr}}")
                
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
        print(f"Error starting backend: {{e}}")
        import traceback
        traceback.print_exc()
        
        # Write an error file that the main app can detect
        with open(os.path.join(script_dir, "backend_error.err"), "w") as f:
            f.write(f"Error starting backend: {{e}}\\n\\n{{traceback.format_exc()}}")
        
        sys.exit(1)

if __name__ == "__main__":
    run_backend()
"""
    
    # Write the backend launcher script
    with open(backend_launcher, 'w') as f:
        f.write(launcher_content)
    
    print(f"Created backend launcher script: {backend_launcher}")
    
    return backend_dir
