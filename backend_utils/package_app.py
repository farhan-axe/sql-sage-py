"""
Main functionality for packaging the SQL Sage application.
"""
import os
import shutil
import subprocess
import platform
from .npm import find_npm
from .frontend import build_frontend
from .electron import setup_electron, build_electron_app, restore_package_json
from .ollama import check_ollama_running, create_ollama_instructions

def find_python_executable():
    """Find a Python executable that exists and works on the system."""
    # Start with hardcoded path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    
    # Check if it exists
    if os.path.exists(hardcoded_python_path):
        print(f"Using hardcoded Python path: {hardcoded_python_path}")
        return os.path.normpath(hardcoded_python_path)
    
    # If not, search for Python in PATH
    print("Hardcoded Python path not found. Searching for Python in PATH...")
    
    # List of possible Python executable names
    python_names = ["python", "python3", "py"]
    if platform.system() == "Windows":
        python_names.extend(["py.exe", "python.exe", "python3.exe"])
    
    # Common installation paths to check
    common_paths = []
    if platform.system() == "Windows":
        # Add common Windows Python installation paths
        for version in ["38", "39", "310", "311", "312"]:
            common_paths.extend([
                os.path.join("C:\\", "Program Files", f"Python{version}", "python.exe"),
                os.path.join("C:\\", "Program Files (x86)", f"Python{version}", "python.exe"),
                os.path.join(os.path.expanduser("~"), "AppData", "Local", "Programs", "Python", f"Python{version}", "python.exe")
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
    
    # First check in PATH
    for name in python_names:
        try:
            # Check if the Python command exists in PATH
            result = subprocess.run([name, "--version"], 
                                   capture_output=True, 
                                   text=True)
            if result.returncode == 0:
                print(f"Found Python in PATH: {name} - {result.stdout.strip()}")
                return name
        except (subprocess.SubprocessError, FileNotFoundError):
            pass
    
    # Then check common paths
    for path in common_paths:
        if os.path.exists(path):
            try:
                result = subprocess.run([path, "--version"], 
                                       capture_output=True, 
                                       text=True)
                if result.returncode == 0:
                    print(f"Found Python at: {path} - {result.stdout.strip()}")
                    return path
            except subprocess.SubprocessError:
                pass
    
    # If we get here, we couldn't find a working Python
    print("WARNING: Could not find a working Python executable.")
    print("The application may not function correctly.")
    
    # Return the default Python command as last resort
    return "python"

def package_application():
    """
    Package the SQL Sage application for distribution.
    """
    print("=== SQL Sage Packaging Script ===")
    
    # Find a working Python executable
    python_path = find_python_executable()
    print(f"Using Python: {python_path}")
    
    # Create a dist directory for our final output
    if not os.path.exists("final_package"):
        os.makedirs("final_package")
    
    # Build the frontend
    try:
        build_frontend()
    except Exception as e:
        print(f"Warning: Frontend build failed with error: {e}")
        print("Continuing with packaging process...")
    
    # Setup Electron
    setup_electron()
    
    try:
        # Build Electron app
        electron_app_path = build_electron_app()
        
        # Create Ollama instructions
        instructions_path = create_ollama_instructions()
        
        # Copy the Electron app to the final package
        final_package_path = os.path.join(os.getcwd(), "final_package", "SQL Sage")
        if os.path.exists(final_package_path):
            shutil.rmtree(final_package_path)
        
        if os.path.exists(electron_app_path):
            shutil.copytree(electron_app_path, final_package_path)
        else:
            print(f"Warning: Electron app path not found at {electron_app_path}")
            if not os.path.exists(final_package_path):
                os.makedirs(final_package_path)
        
        # Copy the instructions
        shutil.copy(instructions_path, os.path.join(final_package_path, "OLLAMA_SETUP.txt"))
        
        # Copy the backend directory to the final package
        backend_dest = os.path.join(final_package_path, "backend")
        if os.path.exists(backend_dest):
            shutil.rmtree(backend_dest)
        
        shutil.copytree(os.path.join(os.getcwd(), "backend"), backend_dest)
        
        # Copy electron.js as main.js if it doesn't exist
        electron_js_path = os.path.join(final_package_path, "resources", "app", "electron.js")
        main_js_path = os.path.join(final_package_path, "resources", "app", "main.js")
        
        if os.path.exists(electron_js_path) and not os.path.exists(main_js_path):
            os.makedirs(os.path.dirname(main_js_path), exist_ok=True)
            shutil.copy(electron_js_path, main_js_path)
        
        # Create a batch file for starting the app with our standalone backend
        batch_file_path = os.path.join(final_package_path, "start_sql_sage.bat")
        with open(batch_file_path, 'w') as f:
            f.write("@echo off\n")
            f.write("echo Starting SQL Sage...\n")
            f.write("\n")
            
            # Find backend path
            f.write("set BACKEND_DIR=%~dp0backend\n")
            
            # Run backend executable if available, otherwise try Python script
            f.write("if exist \"%BACKEND_DIR%\\sql_sage_backend.exe\" (\n")
            f.write("    echo Starting backend executable from: %BACKEND_DIR%\\sql_sage_backend.exe\n")
            f.write("    \"%BACKEND_DIR%\\run_backend.py\"\n")
            f.write(") else (\n")
            f.write("    echo Executable not found, using Python script...\n")
            f.write("    echo Searching for Python installation...\n")
            
            # Add Python detection logic for fallback
            f.write("    set PYTHON_FOUND=0\n")
            
            # First check if Python is in PATH
            f.write("    where python >nul 2>nul\n")
            f.write("    if %ERRORLEVEL% EQU 0 (\n")
            f.write("        echo Found Python in PATH: python\n")
            f.write("        set PYTHON_EXECUTABLE=python\n")
            f.write("        set PYTHON_FOUND=1\n")
            f.write("    )\n\n")
            
            # Then try hardcoded path
            f.write(f'    if exist "{python_path}" (\n')
            f.write(f'        echo Found Python at hardcoded path: {python_path}\n')
            f.write(f'        set PYTHON_EXECUTABLE="{python_path}"\n')
            f.write("        set PYTHON_FOUND=1\n")
            f.write("    )\n\n")
            
            # Check common paths if Python still not found
            f.write("    if %PYTHON_FOUND% EQU 0 (\n")
            f.write("        echo Checking additional Python paths...\n")
            f.write("        set POTENTIAL_PATHS=python python3 py py.exe ")
            
            # Add common Windows Python paths to check
            for version in ["38", "39", "310", "311", "312"]:
                f.write(f'"C:\\Program Files\\Python{version}\\python.exe" ')
                f.write(f'"C:\\Program Files (x86)\\Python{version}\\python.exe" ')
                f.write(f'"C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Python\\Python{version}\\python.exe" ')
            
            # Add the msys2 path that was found in the user's environment
            f.write('"C:\\msys64\\mingw64\\bin\\python.exe" ')
            
            f.write("\n")
            f.write("        for %%p in (%POTENTIAL_PATHS%) do (\n")
            f.write("            echo Checking: %%p\n")
            f.write("            %%p --version >nul 2>nul\n")
            f.write("            if not ERRORLEVEL 1 (\n")
            f.write("                echo Found working Python: %%p\n")
            f.write("                set PYTHON_EXECUTABLE=%%p\n")
            f.write("                set PYTHON_FOUND=1\n")
            f.write("                goto python_found\n")
            f.write("            )\n")
            f.write("        )\n")
            f.write("    )\n")
            f.write("    :python_found\n\n")
            
            f.write("    if %PYTHON_FOUND% EQU 0 (\n")
            f.write("        echo ERROR: Could not find Python installation. Please install Python 3.8 or higher.\n")
            f.write("        echo Press any key to exit...\n")
            f.write("        pause >nul\n")
            f.write("        exit /b 1\n")
            f.write("    )\n\n")
            
            f.write("    echo Using Python: %PYTHON_EXECUTABLE%\n")
            f.write("    echo Starting backend from: %BACKEND_DIR%\\run_backend.py\n")
            f.write("    %PYTHON_EXECUTABLE% %BACKEND_DIR%\\run_backend.py\n")
            f.write(")\n\n")
            
            # Check for Ollama error code
            f.write("if ERRORLEVEL 78 (\n")
            f.write("    echo ERROR: Ollama is not running. Please start Ollama first.\n")
            f.write("    echo See OLLAMA_SETUP.txt for instructions.\n")
            f.write("    echo Press any key to exit...\n")
            f.write("    pause >nul\n")
            f.write("    exit /b 1\n")
            f.write(")\n")
            
            # Start the Electron app
            f.write('start "" "%~dp0SQL Sage.exe"\n')
        
        print(f"\n✅ Packaging complete! Your application is ready in: {final_package_path}")
        print("   Share this folder with users who want to run SQL Sage.")
        print("   Make sure to instruct them to read the OLLAMA_SETUP.txt file first!")
        
    finally:
        # Clean up
        restore_package_json()
        
        # Clean up any temporary files or directories
        temp_dirs = ["build", "dist"]
        for temp_dir in temp_dirs:
            if os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except:
                    print(f"Warning: Could not clean up {temp_dir}")
