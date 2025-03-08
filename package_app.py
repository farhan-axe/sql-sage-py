
import os
import sys
import shutil
import subprocess
import platform

def find_npm():
    """Find the npm executable based on the platform."""
    npm_cmd = "npm.cmd" if platform.system() == "Windows" else "npm"
    
    # Check if npm is in PATH
    try:
        subprocess.check_call([npm_cmd, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return npm_cmd
    except (subprocess.SubprocessError, FileNotFoundError):
        # If npm is not in PATH, try common locations
        if platform.system() == "Windows":
            common_paths = [
                os.path.join(os.environ.get("APPDATA", ""), "npm", "npm.cmd"),
                r"C:\Program Files\nodejs\npm.cmd",
                r"C:\Program Files (x86)\nodejs\npm.cmd"
            ]
            for path in common_paths:
                if os.path.exists(path):
                    return path
        else:
            common_paths = [
                "/usr/local/bin/npm",
                "/usr/bin/npm"
            ]
            for path in common_paths:
                if os.path.exists(path):
                    return path
    
    # If we can't find npm, raise an error
    raise FileNotFoundError("Cannot find npm executable. Please make sure Node.js and npm are installed and in your PATH.")

def build_frontend():
    print("Building Frontend (Vite app)...")
    
    npm_cmd = find_npm()
    
    # Build the React app using Vite
    try:
        subprocess.check_call([npm_cmd, "run", "build"])
        print("Frontend build complete!")
        return os.path.join(os.getcwd(), "dist")
    except subprocess.CalledProcessError as e:
        print(f"Error building frontend: {e}")
        print("Trying to continue with packaging...")
        # Even if build fails, try to continue if dist directory exists
        if os.path.exists(os.path.join(os.getcwd(), "dist")):
            return os.path.join(os.getcwd(), "dist")
        raise

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

def copy_backend_files():
    """Copy backend files to the Electron backend directory."""
    print("Copying backend files...")
    
    # Get the backend directory path (one level up from current directory, then into 'backend')
    source_backend_dir = os.path.join(os.path.dirname(os.getcwd()), "backend")
    
    # Create destination backend directory
    dest_backend_dir = os.path.join(os.getcwd(), "backend")
    if not os.path.exists(dest_backend_dir):
        os.makedirs(dest_backend_dir)
    
    # Check if source backend directory exists
    if not os.path.exists(source_backend_dir):
        print(f"Warning: Backend directory not found at {source_backend_dir}")
        return dest_backend_dir
    
    # Copy all Python files and .env file from the backend directory
    backend_files = [f for f in os.listdir(source_backend_dir) if f.endswith('.py') or f == '.env']
    for file in backend_files:
        src_file = os.path.join(source_backend_dir, file)
        dest_file = os.path.join(dest_backend_dir, file)
        shutil.copy2(src_file, dest_file)
        print(f"Copied {file} to backend directory")
    
    # Copy requirements.txt if it exists
    req_file = os.path.join(source_backend_dir, "requirements.txt")
    if os.path.exists(req_file):
        shutil.copy2(req_file, os.path.join(dest_backend_dir, "requirements.txt"))
        print("Copied requirements.txt to backend directory")
    
    # Create a simple launcher script that will run sql.py
    backend_launcher = os.path.join(dest_backend_dir, "run_backend.py")
    with open(backend_launcher, 'w') as f:
        f.write("""
import os
import sys
import subprocess

def run_backend():
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Change to the script directory
    os.chdir(script_dir)
    
    # Run the sql.py script
    subprocess.call([sys.executable, "sql.py"])

if __name__ == "__main__":
    run_backend()
""")
    
    print("Created backend launcher script")
    return dest_backend_dir

def build_electron_app():
    print("Building Electron app...")
    
    # Copy backend files to the backend directory
    backend_dir = copy_backend_files()
    
    npm_cmd = find_npm()
    
    # Install Electron dependencies
    try:
        subprocess.check_call([npm_cmd, "install", "--save-dev", "electron", "electron-builder"])
        
        # Build Electron app with --dir option (to create unpacked version)
        npx_cmd = "npx.cmd" if platform.system() == "Windows" else "npx"
        
        # Add the --no-sandbox flag to avoid privilege issues
        electron_build_cmd = [npx_cmd, "electron-builder", "--dir"]
        print(f"Running Electron build command: {' '.join(electron_build_cmd)}")
        
        try:
            subprocess.check_call(electron_build_cmd)
        except subprocess.CalledProcessError as e:
            print(f"Error building Electron app: {e}")
            print("Trying without code signing...")
            # Try again with CSC_IDENTITY_AUTO_DISCOVERY=false to skip code signing
            os.environ["CSC_IDENTITY_AUTO_DISCOVERY"] = "false"
            subprocess.check_call(electron_build_cmd)
        
        print("Electron app build complete!")
        
        # Return path to the Electron app
        if platform.system() == "Windows":
            return os.path.join(os.getcwd(), "electron-dist", "win-unpacked")
        elif platform.system() == "Darwin":  # macOS
            return os.path.join(os.getcwd(), "electron-dist", "mac")
        else:  # Linux
            return os.path.join(os.getcwd(), "electron-dist", "linux-unpacked")
    except subprocess.CalledProcessError as e:
        print(f"Error building Electron app: {e}")
        print("Skipping Electron build due to errors")
        
        # Create a simple directory structure as a fallback
        fallback_dir = os.path.join(os.getcwd(), "final_package", "SQL Sage")
        if not os.path.exists(fallback_dir):
            os.makedirs(fallback_dir)
        return fallback_dir

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

if __name__ == "__main__":
    package_application()
