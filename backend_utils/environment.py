
import os
import sys
import platform
import subprocess
import glob

def detect_conda_environment():
    """Detect if we're running in a conda environment and get the python executable path."""
    # Always use the hardcoded path only
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using hardcoded Python path: {hardcoded_python_path}")
    return hardcoded_python_path

def find_python_executable():
    """Find a Python executable path that exists and can be used."""
    # Always use the hardcoded path only
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using hardcoded Python path: {hardcoded_python_path}")
    return os.path.normpath(hardcoded_python_path)
