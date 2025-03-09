
import re
import os
import sys
import platform
import subprocess
import socket
import json

def isNonSqlResponse(question: str) -> bool:
    """Check if a question is likely not related to database content."""
    # This is a placeholder - move the actual implementation here
    return False

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
    """Find a valid Python executable path for Electron to use."""
    # Check if there's a config file with a Python path
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "python_config.json")
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                if 'python_path' in config and os.path.exists(config['python_path']):
                    print(f"Using Python path from config: {config['python_path']}")
                    return config['python_path']
        except Exception as e:
            print(f"Error loading Python config: {e}")
    
    # Try the hardcoded path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    if os.path.exists(hardcoded_python_path):
        print(f"Using hardcoded Python path: {hardcoded_python_path}")
        return os.path.normpath(hardcoded_python_path)
    
    # Search for Python in PATH
    python_names = ["python", "python3", "py"]
    if platform.system() == "Windows":
        python_names.extend(["py.exe", "python.exe", "python3.exe"])
    
    for name in python_names:
        try:
            result = subprocess.run([name, "--version"], 
                                   capture_output=True, 
                                   text=True)
            if result.returncode == 0:
                print(f"Found Python in PATH: {name}")
                return name
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
    
    # Check common installation paths
    common_paths = []
    if platform.system() == "Windows":
        for version in ["38", "39", "310", "311", "312"]:
            common_paths.extend([
                os.path.join("C:\\", "Program Files", f"Python{version}", "python.exe"),
                os.path.join("C:\\", "Program Files (x86)", f"Python{version}", "python.exe"),
                os.path.join(os.path.expanduser("~"), "AppData", "Local", "Programs", "Python", f"Python{version}", "python.exe")
            ])
        # Add msys2 path
        common_paths.append(r"C:\msys64\mingw64\bin\python.exe")
    
    for path in common_paths:
        if os.path.exists(path):
            try:
                result = subprocess.run([path, "--version"], 
                                       capture_output=True, 
                                       text=True)
                if result.returncode == 0:
                    print(f"Found Python at: {path}")
                    return path
            except subprocess.SubprocessError:
                pass
    
    # As a last resort, just use "python"
    print("Could not find Python path. Using 'python' command.")
    return "python"

def detect_conda_environment():
    """
    Detect if we're in a conda environment and get its details.
    Returns a tuple of (is_conda_env, python_path, env_name)
    """
    python_path = find_python_executable()
    
    # Check if this is a conda environment
    try:
        result = subprocess.run([python_path, "-c", "import os; print('CONDA_PREFIX' in os.environ)"], 
                               capture_output=True, 
                               text=True)
        is_conda = result.stdout.strip() == "True"
        
        if is_conda:
            # Get conda environment name
            result = subprocess.run([python_path, "-c", "import os; print(os.environ.get('CONDA_PREFIX', '').split(os.sep)[-1])"], 
                                   capture_output=True, 
                                   text=True)
            env_name = result.stdout.strip()
            return (True, python_path, env_name)
    except:
        pass
    
    # Not a conda environment or failed to detect
    return (False, python_path, None)
