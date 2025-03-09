import re
import os
import sys
import platform
import subprocess
import socket

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
    # Always use only the hardcoded path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using hardcoded Python path: {hardcoded_python_path}")
    return hardcoded_python_path

def detect_conda_environment():
    """
    Detect if we're in a conda environment and get its details.
    Returns a tuple of (is_conda_env, python_path, env_name)
    """
    # Always use only the hardcoded path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    return (True, hardcoded_python_path, "sqlbot")
