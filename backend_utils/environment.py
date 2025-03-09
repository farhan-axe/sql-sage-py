
import os
import sys
import platform
import subprocess
import glob

def detect_conda_environment():
    """Detect if we're running in a conda environment and get the python executable path."""
    # Always use user's specific path as the only path
    user_specific_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using user-specified Python path: {user_specific_path}")
    return user_specific_path

def find_python_executable():
    """Find a Python executable path that exists and can be used."""
    # Always use the user's specific path - this is the only option now
    user_specific_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using user-specified Python path: {user_specific_path}")
    return os.path.normpath(user_specific_path)
