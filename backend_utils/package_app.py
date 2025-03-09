
"""
Main functionality for packaging the SQL Sage application.
"""
import os
import shutil
import subprocess
from .npm import find_npm
from .frontend import build_frontend
from .electron import setup_electron, build_electron_app, restore_package_json
from .ollama import check_ollama_running, create_ollama_instructions

def package_application():
    """
    Package the SQL Sage application for distribution.
    """
    print("=== SQL Sage Packaging Script ===")
    
    # Hard-coded python path that we know works
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using hardcoded Python path: {hardcoded_python_path}")
    
    # Verify the Python path exists
    if os.path.exists(hardcoded_python_path):
        print(f"Python path verified: {hardcoded_python_path}")
    else:
        print(f"WARNING: Hardcoded Python path not found: {hardcoded_python_path}")
        print("The packaging process may fail. Please check this path exists.")
    
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
        
        # Create a batch file for starting the app using the hardcoded Python
        batch_file_path = os.path.join(final_package_path, "start_sql_sage.bat")
        with open(batch_file_path, 'w') as f:
            f.write("@echo off\n")
            f.write("echo Starting SQL Sage...\n")
            f.write(f'set PYTHON_EXECUTABLE="{hardcoded_python_path}"\n')
            f.write('"%~dp0SQL Sage.exe"\n')
        
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
