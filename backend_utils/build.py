
import os
import shutil
import subprocess
import platform
import sys
from .path_finder import find_backend_directory
from .environment import detect_conda_environment, find_python_executable
from .launcher import create_backend_launcher

def build_backend():
    """
    Build the backend with PyInstaller to create a standalone executable
    that doesn't require Python to be installed.
    """
    print("Building backend with PyInstaller...")
    
    # Find the backend directory
    source_backend_dir = find_backend_directory()
    
    if not source_backend_dir:
        print("ERROR: Backend directory not found.")
        return None
    
    # Create a local backend directory for packaging
    backend_dir = os.path.join(os.getcwd(), "backend")
    if not os.path.exists(backend_dir):
        os.makedirs(backend_dir)
    
    # Find a working Python executable
    python_path = find_python_executable()
    print(f"Using Python executable: {python_path}")
    
    # Try to install PyInstaller if not already installed
    try:
        subprocess.check_call([python_path, "-m", "pip", "install", "pyinstaller"])
        print("PyInstaller installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"Failed to install PyInstaller: {e}")
        print("Falling back to copying Python files...")
        return fallback_copy_files(source_backend_dir, backend_dir, python_path)
    
    # Copy all Python files to a temp directory for building
    build_dir = os.path.join(os.getcwd(), "build_temp")
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    os.makedirs(build_dir)
    
    # Copy Python files from source to build directory
    files_to_copy = [f for f in os.listdir(source_backend_dir) 
                    if f.endswith('.py') or f == '.env' or f.endswith('.json')]
    
    for file in files_to_copy:
        src_file = os.path.join(source_backend_dir, file)
        dest_file = os.path.join(build_dir, file)
        try:
            shutil.copy2(src_file, dest_file)
            print(f"Copied {file} to build directory")
        except Exception as e:
            print(f"Error copying {file}: {e}")
    
    # Copy requirements.txt if it exists
    req_file = os.path.join(source_backend_dir, "requirements.txt")
    if os.path.exists(req_file):
        shutil.copy2(req_file, os.path.join(build_dir, "requirements.txt"))
        print("Copied requirements.txt to build directory")
    
    # Install requirements before building
    try:
        subprocess.check_call([python_path, "-m", "pip", "install", "-r", os.path.join(build_dir, "requirements.txt")])
        print("Installed Python requirements")
    except Exception as e:
        print(f"Error installing requirements: {e}")
    
    # Determine the main script to build
    main_script = os.path.join(build_dir, "api_routes.py")
    if not os.path.exists(main_script):
        main_script = os.path.join(build_dir, "sql.py")
        if not os.path.exists(main_script):
            print("ERROR: Could not find api_routes.py or sql.py in the backend directory")
            return fallback_copy_files(source_backend_dir, backend_dir, python_path)
    
    # Build with PyInstaller
    print(f"Building executable from {main_script}")
    pyinstaller_args = [
        python_path, "-m", "PyInstaller", 
        "--onefile",
        "--distpath", backend_dir,
        "--workpath", os.path.join(build_dir, "build"),
        "--specpath", os.path.join(build_dir, "spec"),
        "--name", "sql_sage_backend",
        main_script
    ]
    
    try:
        # Set environment variables to help PyInstaller find dependencies
        my_env = os.environ.copy()
        my_env["PYTHONPATH"] = source_backend_dir
        
        subprocess.check_call(pyinstaller_args, env=my_env)
        print("PyInstaller build completed successfully")
        
        # Copy the .env file to the destination directory
        env_file = os.path.join(source_backend_dir, ".env")
        if os.path.exists(env_file):
            shutil.copy2(env_file, os.path.join(backend_dir, ".env"))
            print("Copied .env file to backend directory")
        else:
            # Create a default .env file
            with open(os.path.join(backend_dir, ".env"), 'w') as f:
                f.write("# Default configuration\nMODEL=deepseek-r1:8b\nPORT=5000\n")
            print("Created default .env file")
        
        # Create a simple batch file to run the executable
        create_executable_launcher(backend_dir)
        
        # Clean up
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
        
        print("Backend build complete!")
        return backend_dir
        
    except subprocess.CalledProcessError as e:
        print(f"PyInstaller build failed: {e}")
        print("Falling back to copying Python files...")
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
        return fallback_copy_files(source_backend_dir, backend_dir, python_path)

def create_executable_launcher(backend_dir):
    """Create a batch file that will run the backend executable"""
    launcher_path = os.path.join(backend_dir, "run_backend.py")
    
    launcher_content = """
import os
import subprocess
import platform
import time
import socket
import sys

def check_ollama_running(host="localhost", port=11434):
    \"\"\"Check if Ollama server is running by attempting to connect to its port.\"\"\"
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2)
            result = s.connect_ex((host, port))
            return result == 0
    except:
        return False

def run_backend():
    \"\"\"Run the backend executable.\"\"\"
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print(f"Working directory: {os.getcwd()}")
    print(f"System platform: {platform.platform()}")
    
    # Check if Ollama is running
    if not check_ollama_running():
        print("WARNING: Ollama service appears to be not running on the default port (11434).")
        print("The SQL Sage application requires Ollama to be running. Please start Ollama and try again.")
        
        with open(os.path.join(script_dir, "ollama_not_running.err"), "w") as f:
            f.write("Ollama service is not running. Please start Ollama and restart the application.")
        
        sys.exit(78)  # Custom error code to indicate Ollama not running
    else:
        print("Ollama service appears to be running.")
        if os.path.exists(os.path.join(script_dir, "ollama_not_running.err")):
            os.remove(os.path.join(script_dir, "ollama_not_running.err"))
    
    # Run the backend executable
    backend_exe = os.path.join(script_dir, "sql_sage_backend")
    if platform.system() == "Windows":
        backend_exe += ".exe"
    
    print(f"Starting backend executable: {backend_exe}")
    
    # On Windows, use the appropriate method to hide the console window
    startup_info = None
    if platform.system() == "Windows":
        startup_info = subprocess.STARTUPINFO()
        startup_info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startup_info.wShowWindow = 0  # SW_HIDE
    
    try:
        process = subprocess.Popen(
            backend_exe,
            shell=False,
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
            
            with open(os.path.join(script_dir, "backend_start_failed.err"), "w") as f:
                f.write(f"Backend process failed to start\\n\\nDetails:\\n{stderr}")
            
            sys.exit(1)
        else:
            print("Backend process started successfully")
    except Exception as e:
        print(f"Error starting backend: {e}")
        import traceback
        traceback.print_exc()
        
        with open(os.path.join(script_dir, "backend_error.err"), "w") as f:
            f.write(f"Error starting backend: {e}\\n\\n{traceback.format_exc()}")
        
        sys.exit(1)

if __name__ == "__main__":
    run_backend()
"""
    
    with open(launcher_path, 'w') as f:
        f.write(launcher_content)
    
    # Create a batch file for Windows
    if platform.system() == "Windows":
        batch_path = os.path.join(backend_dir, "run_backend.bat")
        with open(batch_path, 'w') as f:
            f.write("@echo off\r\n")
            f.write("echo Starting SQL Sage Backend...\r\n")
            f.write("python run_backend.py\r\n")
    
    print(f"Created backend launcher script: {launcher_path}")

def fallback_copy_files(source_backend_dir, backend_dir, python_path):
    """Fallback method that copies files directly if PyInstaller fails"""
    print("Using fallback method: Copying Python files directly")
    
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
    
    # Create a run_backend.py file which will be our entry point
    create_backend_launcher(backend_dir, python_path=python_path)
    
    print("Backend preparation complete!")
    return backend_dir
