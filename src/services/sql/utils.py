
import re
import os
import sys
import platform
import subprocess

def isNonSqlResponse(question: str) -> bool:
    """Check if a question is likely not related to database content."""
    # This is a placeholder - move the actual implementation here
    return False

def find_python_executable():
    """Find a valid Python executable path for Electron to use."""
    # Check if we're running in a conda environment
    conda_prefix = os.environ.get('CONDA_PREFIX')
    if conda_prefix:
        if platform.system() == "Windows":
            conda_python = os.path.join(conda_prefix, "python.exe")
        else:
            conda_python = os.path.join(conda_prefix, "bin", "python")
        
        if os.path.exists(conda_python):
            return conda_python
    
    # Check for specific conda environment - 'sqlbot'
    try:
        # Try to detect conda environments using conda command
        if platform.system() == "Windows":
            conda_cmd = "conda.exe"
        else:
            conda_cmd = "conda"
        
        result = subprocess.run([conda_cmd, "env", "list"], capture_output=True, text=True)
        if result.returncode == 0:
            env_lines = result.stdout.splitlines()
            for line in env_lines:
                if 'sqlbot' in line:
                    env_path = line.split()[-1]  # Path is usually the last item
                    if platform.system() == "Windows":
                        python_path = os.path.join(env_path, "python.exe")
                    else:
                        python_path = os.path.join(env_path, "bin", "python")
                    if os.path.exists(python_path):
                        return python_path
    except (subprocess.SubprocessError, FileNotFoundError):
        # If conda command fails, continue with other detection methods
        pass
    
    # Try checking for specific conda environment paths
    if platform.system() == "Windows":
        potential_conda_paths = [
            os.path.expanduser("~/miniconda3/envs/sqlbot/python.exe"),
            os.path.expanduser("~/anaconda3/envs/sqlbot/python.exe"),
            os.path.expanduser("~/AppData/Local/miniconda3/envs/sqlbot/python.exe"),
            os.path.expanduser("~/AppData/Local/Continuum/miniconda3/envs/sqlbot/python.exe"),
            os.path.expanduser("~/AppData/Local/anaconda3/envs/sqlbot/python.exe"),
            # Add more potential paths for Windows
            "C:\\Users\\farha\\anaconda3\\envs\\sqlbot\\python.exe",  # Known path from user's environment
            "C:\\ProgramData\\Anaconda3\\envs\\sqlbot\\python.exe",
            "C:\\ProgramData\\miniconda3\\envs\\sqlbot\\python.exe",
        ]
    else:
        potential_conda_paths = [
            os.path.expanduser("~/miniconda3/envs/sqlbot/bin/python"),
            os.path.expanduser("~/anaconda3/envs/sqlbot/bin/python"),
            "/opt/anaconda3/envs/sqlbot/bin/python",
            "/opt/miniconda3/envs/sqlbot/bin/python",
        ]
    
    for path in potential_conda_paths:
        if os.path.exists(path):
            return path
    
    # Check common locations for Python
    if platform.system() == "Windows":
        common_paths = [
            sys.executable,
            r"C:\Python39\python.exe",
            r"C:\Python310\python.exe",
            r"C:\Program Files\Python39\python.exe",
            r"C:\Program Files\Python310\python.exe",
            r"C:\Program Files (x86)\Python39\python.exe",
            r"C:\Program Files (x86)\Python310\python.exe",
        ]
    else:
        common_paths = [
            sys.executable,
            "/usr/bin/python3",
            "/usr/local/bin/python3",
            "/opt/homebrew/bin/python3",
        ]
    
    for path in common_paths:
        if os.path.exists(path):
            return path
    
    # As a last resort, use the default command
    return "python" if platform.system() == "Windows" else "python3"

def detect_conda_environment():
    """
    Detect if we're in a conda environment and get its details.
    Returns a tuple of (is_conda_env, python_path, env_name)
    """
    # Check if we're in a conda environment
    conda_prefix = os.environ.get('CONDA_PREFIX')
    env_name = os.environ.get('CONDA_DEFAULT_ENV')
    
    if conda_prefix:
        # Get the python executable path within the conda environment
        if platform.system() == "Windows":
            python_exe = os.path.join(conda_prefix, "python.exe")
        else:
            python_exe = os.path.join(conda_prefix, "bin", "python")
        
        if os.path.exists(python_exe):
            return (True, python_exe, env_name or "unknown")
    
    # If specific environment needed (e.g., 'sqlbot')
    try:
        # Check if 'conda' command exists and try to get env info
        if platform.system() == "Windows":
            conda_cmd = "conda.exe"
        else:
            conda_cmd = "conda"
        
        result = subprocess.run([conda_cmd, "env", "list"], capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if 'sqlbot' in line:
                    env_path = line.split()[-1]
                    if platform.system() == "Windows":
                        python_path = os.path.join(env_path, "python.exe")
                    else:
                        python_path = os.path.join(env_path, "bin", "python")
                    
                    if os.path.exists(python_path):
                        return (True, python_path, "sqlbot")
    except:
        pass
    
    # Not in a conda environment
    return (False, sys.executable, None)
