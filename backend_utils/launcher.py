
import os
import platform
import time
from .ollama import check_ollama_running

def create_backend_launcher(backend_dir, has_source=True, python_path=None):
    """Create a launcher script that will run sql.py"""
    backend_launcher = os.path.join(backend_dir, "run_backend.py")
    
    # Define the hardcoded Python path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    
    # Normalize the path to use proper path separators
    hardcoded_python_path = os.path.normpath(hardcoded_python_path)
    
    # Write the launcher script content
    launcher_content = f"""
import os
import sys
import subprocess
import platform
import time
import glob
import socket

# Hard-coded python path that we know works
HARDCODED_PYTHON_PATH = {repr(hardcoded_python_path)}

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
    \"\"\"Find a Python executable path that works on the system.\"\"\"
    # If the hardcoded Python path exists, ALWAYS use it first
    if os.path.exists(HARDCODED_PYTHON_PATH):
        print(f"Using hardcoded Python path: {{HARDCODED_PYTHON_PATH}}")
        return HARDCODED_PYTHON_PATH
    
    # If the hardcoded path doesn't exist, look for Python in common paths
    print("Hardcoded Python path not found. Looking for specific Python paths...")
    
    # Check common installation paths, focusing on full paths first
    common_paths = []
    if platform.system() == "Windows":
        # Add common Windows Python installation paths
        for version in ["311", "310", "39", "38", "312"]:
            common_paths.extend([
                os.path.join("C:\\", "Program Files", f"Python{{version}}", "python.exe"),
                os.path.join("C:\\", "Program Files (x86)", f"Python{{version}}", "python.exe"),
                os.path.join(os.path.expanduser("~"), "AppData", "Local", "Programs", "Python", f"Python{{version}}", "python.exe")
            ])
        # Add msys2 path that was found in the user's environment
        common_paths.append(r"C:\msys64\mingw64\bin\python.exe")
    elif platform.system() == "Darwin":  # macOS
        common_paths.extend([
            "/usr/bin/python3",
            "/usr/local/bin/python3",
            "/opt/homebrew/bin/python3"
        ])
    else:  # Linux and other systems
        common_paths.extend([
            "/usr/bin/python3",
            "/usr/local/bin/python3"
        ])
    
    # Try specific paths first - we want full absolute paths!
    for path in common_paths:
        if os.path.exists(path):
            try:
                # Test if the Python executable works
                result = subprocess.run([path, "--version"], 
                                       capture_output=True, 
                                       text=True,
                                       timeout=5)
                if result.returncode == 0:
                    print(f"Found working Python at: {{path}}")
                    return path
            except subprocess.SubprocessError:
                pass
    
    # As a last resort, try to find Python in PATH
    python_names = ["python.exe", "python3.exe", "py.exe", "python", "python3", "py"]
    
    for name in python_names:
        try:
            # Try to get the full path of the Python command
            if platform.system() == "Windows":
                path_cmd = f"where {{name}}"
            else:
                path_cmd = f"which {{name}}"
                
            result = subprocess.run(path_cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0 and result.stdout.strip():
                full_path = result.stdout.strip().split('\\n')[0]
                if os.path.exists(full_path):
                    print(f"Found Python in PATH: {{full_path}}")
                    return full_path
        except subprocess.SubprocessError:
            pass
    
    # If we get here, we couldn't find a working Python
    print("WARNING: Could not find a working Python executable.")
    print("The application may not function correctly.")
    print("Returning 'python' as a last resort, but this may not work.")
    
    # Return a basic command as last resort - but this likely won't work
    return "python"

def run_backend():
    \"\"\"Run the backend server using the best available Python executable.\"\"\"
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
    
    # Find a working Python executable - ALWAYS use the full absolute path
    python_exe = find_python_executable()
    print(f"Using Python executable: {{python_exe}}")

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
            
            # CRITICAL: Always use the full path to Python, never just 'python'
            cmd = [python_exe, api_routes_path]
            print(f"Executing command: {{cmd}}")
            
            # Create a .bat file on Windows with ABSOLUTE path for more reliable execution
            if platform.system() == "Windows":
                bat_path = os.path.join(script_dir, "run_api_absolute.bat")
                with open(bat_path, 'w') as f:
                    f.write("@echo off\\n")
                    f.write("echo Starting SQL Sage API with absolute path...\\n")
                    f.write(f'"{{python_exe}}" "{{api_routes_path}}"\\n')
                print(f"Created batch file with absolute paths: {{bat_path}}")
                # Use this as our command instead
                cmd = bat_path
                use_shell = True
            else:
                use_shell = False
            
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
            
            # CRITICAL: Always use the full path to Python
            cmd = [python_exe, sql_path]
            
            # Create a .bat file on Windows with ABSOLUTE path for more reliable execution
            if platform.system() == "Windows":
                bat_path = os.path.join(script_dir, "run_sql_absolute.bat")
                with open(bat_path, 'w') as f:
                    f.write("@echo off\\n")
                    f.write("echo Starting SQL Sage API (sql.py) with absolute path...\\n")
                    f.write(f'"{{python_exe}}" "{{sql_path}}"\\n')
                print(f"Created batch file with absolute paths: {{bat_path}}")
                # Use this as our command instead
                cmd = bat_path
                use_shell = True
            else:
                use_shell = False
            
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
    
    # Create a batch file for Windows to run the launcher
    if platform.system() == "Windows":
        batch_path = os.path.join(backend_dir, "run_backend.bat")
        with open(batch_path, 'w') as f:
            f.write("@echo off\r\n")
            f.write("echo Starting SQL Sage Backend...\r\n")
            
            # First check if python.exe is in the same directory
            f.write("if exist \"%~dp0python.exe\" (\r\n")
            f.write("    echo Using bundled Python executable\r\n")
            f.write("    \"%~dp0python.exe\" \"%~dp0run_backend.py\"\r\n")
            f.write(") else (\r\n")
            
            # If there's a Python executable found during packaging, use it
            if python_path and os.path.exists(python_path):
                f.write(f"    echo Using detected Python: {python_path}\r\n")
                f.write(f"    \"{python_path}\" \"%~dp0run_backend.py\"\r\n")
            else:
                # Otherwise, use any Python in PATH
                f.write("    echo Searching for Python in system...\r\n")
                # Try to use Python from PATH
                f.write("    python \"%~dp0run_backend.py\"\r\n")
            
            f.write(")\r\n")
    
    return backend_dir
