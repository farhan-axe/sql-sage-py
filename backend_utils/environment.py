
import os
import sys
import platform
import subprocess
import glob

def detect_conda_environment():
    """Detect if we're running in a conda environment and get the python executable path."""
    # Try the hardcoded path first
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    
    if os.path.exists(hardcoded_python_path):
        print(f"Using hardcoded Python path: {hardcoded_python_path}")
        return hardcoded_python_path
    
    # If hardcoded path doesn't exist, look for Python in system
    print("Hardcoded path not found. Looking for Python in system...")
    
    # Look for python in PATH
    try:
        if platform.system() == "Windows":
            python_cmd = "where python"
        else:
            python_cmd = "which python3 || which python"
        
        result = subprocess.check_output(python_cmd, shell=True, text=True).strip()
        if result and os.path.exists(result.splitlines()[0]):
            python_path = result.splitlines()[0]
            print(f"Found Python in PATH: {python_path}")
            return python_path
    except subprocess.SubprocessError:
        pass
    
    # As a last resort, just return "python" and hope it's in PATH
    print("Could not find Python path. Using 'python' command.")
    return "python"

def find_python_executable():
    """Find a Python executable path that exists and can be used."""
    # Check for hardcoded path first
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    
    if os.path.exists(hardcoded_python_path):
        print(f"Using hardcoded Python path: {hardcoded_python_path}")
        return os.path.normpath(hardcoded_python_path)
    
    # Next, look for Python in PATH
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
        # Add msys2 path that was found in the user's environment
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
    
    # As a last resort, return "python"
    print("Could not find Python path. Using 'python' command.")
    return "python"
