
import os
import platform
import time
from .ollama import check_ollama_running

def create_backend_launcher(backend_dir, has_source=True, python_path=None):
    """Create a launcher script that will run sql.py"""
    backend_launcher = os.path.join(backend_dir, "run_backend.py")
    
    # Always use only the hardcoded Python path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    
    # Always use the hardcoded path no matter what
    python_path = hardcoded_python_path
    print(f"Using hardcoded Python path: {hardcoded_python_path}")
    
    # FIX: Normalize the path to use proper path separators
    hardcoded_python_path = os.path.normpath(hardcoded_python_path)
    
    # Define ONLY the hardcoded conda path for the launcher script
    potential_conda_paths = [
        os.path.normpath(hardcoded_python_path)
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

# Hard-coded python path that we know works - this is the ONLY path we will use
HARDCODED_PYTHON_PATH = {repr(hardcoded_python_path)}

# We will always use only this path
CONDA_PYTHON_PATH = {repr(hardcoded_python_path)}

# Only include the hardcoded path in potential paths
POTENTIAL_CONDA_PATHS = {repr([hardcoded_python_path])}

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
    \"\"\"Always return the hardcoded Python path.\"\"\"
    # Only use the hardcoded Python path, nothing else
    print(f"Using hardcoded Python path: {{HARDCODED_PYTHON_PATH}}")
    return HARDCODED_PYTHON_PATH

def run_backend():
    \"\"\"Run the backend server using the hardcoded Python executable.\"\"\"
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
    print("Using hardcoded Python path:", HARDCODED_PYTHON_PATH)
    print("Exists:", "YES" if os.path.exists(HARDCODED_PYTHON_PATH) else "NO")

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
    
    # Always use only the hardcoded Python executable
    python_exe = HARDCODED_PYTHON_PATH
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
            cmd = [python_exe, api_routes_path]
            print(f"Executing command: {{cmd}}")
            
            # Create a .bat file on Windows with ABSOLUTE path for more reliable execution
            if platform.system() == "Windows":
                bat_path = os.path.join(script_dir, "run_api_absolute.bat")
                with open(bat_path, 'w') as f:
                    f.write("@echo off\\n")
                    f.write("echo Starting SQL Sage API with absolute path...\\n")
                    # FIX: Use the python_exe variable which is assigned to HARDCODED_PYTHON_PATH
                    f.write(f'"{python_exe}" "{api_routes_path}"\\n')
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
            
            # Build command with full path
            cmd = [python_exe, sql_path]
            
            # Create a .bat file on Windows with ABSOLUTE path for more reliable execution
            if platform.system() == "Windows":
                bat_path = os.path.join(script_dir, "run_sql_absolute.bat")
                with open(bat_path, 'w') as f:
                    f.write("@echo off\\n")
                    f.write("echo Starting SQL Sage API (sql.py) with absolute path...\\n")
                    # FIX: Use the python_exe variable which is assigned to HARDCODED_PYTHON_PATH
                    f.write(f'"{python_exe}" "{sql_path}"\\n')
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

