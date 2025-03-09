
import os
import sys
import platform
import subprocess
import glob

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
    except Exception as e:
        print(f"Failed to detect conda environments via conda command: {e}")
    
    # Try specific known paths for the sqlbot environment
    if platform.system() == "Windows":
        known_paths = [
            os.path.expanduser("~/anaconda3/envs/sqlbot/python.exe"),
            os.path.expanduser("~/miniconda3/envs/sqlbot/python.exe"),
            "C:\\Users\\farha\\anaconda3\\envs\\sqlbot\\python.exe",  # Known path from user's environment
            "C:\\ProgramData\\Anaconda3\\envs\\sqlbot\\python.exe",
        ]
        
        for path in known_paths:
            if os.path.exists(path):
                print(f"Found sqlbot environment Python at: {path}")
                return path
    
    # Detect via system PATH
    try:
        # Try to find python in PATH
        python_cmd = "python" if platform.system() == "Windows" else "python3"
        path_result = subprocess.run([python_cmd, "--version"], 
                               capture_output=True, text=True)
        if path_result.returncode == 0:
            print(f"Found system Python: {python_cmd}")
            return python_cmd
    except Exception as e:
        print(f"Failed to detect Python in PATH: {e}")
    
    # Last resort: use sys.executable
    print(f"Using system Python: {sys.executable}")
    return sys.executable

def find_python_executable():
    """Find a Python executable path that exists and can be used."""
    # First try conda environment
    python_path = detect_conda_environment()
    
    # Normalize the path to use proper separators for the OS
    if python_path:
        return os.path.normpath(python_path)
    
    # If no conda environment found, check common locations
    common_locations = []
    
    if platform.system() == "Windows":
        common_locations = [
            r"C:\Python39\python.exe",
            r"C:\Python310\python.exe",
            r"C:\Program Files\Python39\python.exe",
            r"C:\Program Files\Python310\python.exe",
            r"C:\Program Files (x86)\Python39\python.exe",
            r"C:\Program Files (x86)\Python310\python.exe",
            # Add conda paths
            os.path.expanduser(r"~\miniconda3\python.exe"),
            os.path.expanduser(r"~\anaconda3\python.exe"),
        ]
        
        # Also try to find Python installations using glob
        python_glob_patterns = [
            "C:\\Python*\\python.exe",
            "C:\\Program Files\\Python*\\python.exe",
            "C:\\Program Files (x86)\\Python*\\python.exe",
            os.path.join(os.environ.get('LOCALAPPDATA', ''), "Programs", "Python", "Python*", "python.exe")
        ]
        
        for pattern in python_glob_patterns:
            matches = glob.glob(pattern)
            common_locations.extend(matches)
    else:
        common_locations = [
            "/usr/bin/python3",
            "/usr/local/bin/python3",
            "/opt/homebrew/bin/python3",
            os.path.expanduser("~/miniconda3/bin/python"),
            os.path.expanduser("~/anaconda3/bin/python"),
        ]
    
    for path in common_locations:
        if os.path.exists(path):
            return os.path.normpath(path)
    
    # As a last resort, return a basic command
    return "python" if platform.system() == "Windows" else "python3"
