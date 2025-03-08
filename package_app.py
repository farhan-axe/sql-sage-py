
import os
import sys
import shutil
import subprocess
import platform

def build_frontend():
    print("Building Frontend (Vite app)...")
    
    # Build the React app using Vite
    subprocess.check_call(["npm", "run", "build"])
    
    print("Frontend build complete!")
    return os.path.join(os.getcwd(), "dist")

def setup_electron():
    print("Setting up Electron packaging...")
    
    # Copy the electron package.json to package.json.bak to use for building
    if os.path.exists("package.json.bak"):
        os.remove("package.json.bak")
    
    shutil.copy("package.json", "package.json.bak")
    shutil.copy("electron-package.json", "package.json")
    
    # Create backend directory for Electron resources
    backend_dir = os.path.join(os.getcwd(), "backend")
    if not os.path.exists(backend_dir):
        os.makedirs(backend_dir)
    
    return backend_dir

def restore_package_json():
    # Restore the original package.json
    if os.path.exists("package.json.bak"):
        shutil.copy("package.json.bak", "package.json")
        os.remove("package.json.bak")

def build_electron_app(backend_exe_path):
    print("Building Electron app...")
    
    # Copy backend executable to the backend directory
    backend_dir = os.path.join(os.getcwd(), "backend")
    
    # Determine the executable name based on the platform
    executable_name = "sql-sage-backend.exe" if platform.system() == "Windows" else "sql-sage-backend"
    dest_path = os.path.join(backend_dir, executable_name)
    
    # Copy the executable and make it executable if needed
    shutil.copy(backend_exe_path, dest_path)
    if platform.system() != "Windows":
        os.chmod(dest_path, 0o755)  # Make executable on Unix-like systems
    
    # Copy .env file to backend directory
    if os.path.exists(".env"):
        shutil.copy(".env", os.path.join(backend_dir, ".env"))
    
    # Install Electron dependencies
    subprocess.check_call(["npm", "install", "--save-dev", "electron", "electron-builder"])
    
    # Build Electron app
    subprocess.check_call(["npx", "electron-builder", "--dir"])
    
    print("Electron app build complete!")
    
    # Return path to the Electron app
    if platform.system() == "Windows":
        return os.path.join(os.getcwd(), "electron-dist", "win-unpacked")
    elif platform.system() == "Darwin":  # macOS
        return os.path.join(os.getcwd(), "electron-dist", "mac")
    else:  # Linux
        return os.path.join(os.getcwd(), "electron-dist", "linux-unpacked")

def create_ollama_instructions():
    instructions = """
SQL Sage - Ollama Setup Instructions
====================================

Before running SQL Sage, you need to install Ollama and download the required model:

1. Download and install Ollama from https://ollama.ai

2. Open a terminal/command prompt and run:
   ollama pull deepseek-r1:8b

   (For better performance, you can use the larger model):
   ollama pull deepseek-r1:14b

3. Make sure Ollama is running before launching SQL Sage.

4. You can customize the model by editing the .env file in the application directory.
"""
    
    with open("OLLAMA_SETUP.txt", "w") as f:
        f.write(instructions)
    
    return "OLLAMA_SETUP.txt"

def package_application():
    print("=== SQL Sage Packaging Script ===")
    
    # Create a dist directory for our final output
    if not os.path.exists("final_package"):
        os.makedirs("final_package")
    
    # Build the backend executable
    from build_backend import build_backend
    backend_exe_path = build_backend()
    
    # Build the frontend
    build_frontend()
    
    # Setup Electron
    setup_electron()
    
    try:
        # Build Electron app
        electron_app_path = build_electron_app(backend_exe_path)
        
        # Create Ollama instructions
        instructions_path = create_ollama_instructions()
        
        # Copy the Electron app to the final package
        final_package_path = os.path.join(os.getcwd(), "final_package", "SQL Sage")
        if os.path.exists(final_package_path):
            shutil.rmtree(final_package_path)
        
        shutil.copytree(electron_app_path, final_package_path)
        
        # Copy the instructions
        shutil.copy(instructions_path, os.path.join(final_package_path, "OLLAMA_SETUP.txt"))
        
        print(f"\n✅ Packaging complete! Your application is ready in: {final_package_path}")
        print("   Share this folder with users who want to run SQL Sage.")
        print("   Make sure to instruct them to read the OLLAMA_SETUP.txt file first!")
        
    finally:
        # Clean up
        restore_package_json()

if __name__ == "__main__":
    package_application()
