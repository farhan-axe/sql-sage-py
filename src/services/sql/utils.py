
import re
import os
import sys
import platform

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
    
    # Try checking for specific conda environment - 'sqlbot'
    if platform.system() == "Windows":
        potential_conda_paths = [
            os.path.expanduser("~/miniconda3/envs/sqlbot/python.exe"),
            os.path.expanduser("~/anaconda3/envs/sqlbot/python.exe"),
        ]
    else:
        potential_conda_paths = [
            os.path.expanduser("~/miniconda3/envs/sqlbot/bin/python"),
            os.path.expanduser("~/anaconda3/envs/sqlbot/bin/python"),
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
