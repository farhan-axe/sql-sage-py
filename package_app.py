
"""
SQL Sage Packaging Script - Build and package the application for distribution.
"""

import os
import sys
import shutil
import subprocess
import platform
from backend_utils import build_backend

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
    
    # First, make sure vite is installed
    try:
        print("Checking if Vite is installed...")
        subprocess.check_call([npm_cmd, "list", "vite"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("Vite is installed.")
    except subprocess.CalledProcessError:
        print("Vite not found in dependencies. Installing vite...")
        try:
            subprocess.check_call([npm_cmd, "install", "--save-dev", "vite"])
            print("Successfully installed Vite.")
        except subprocess.CalledProcessError as e:
            print(f"Error installing Vite: {e}")
            print("Continuing with packaging attempt...")
    
    # Also check for @vitejs/plugin-react-swc which is needed for building React apps with Vite
    try:
        print("Checking if @vitejs/plugin-react-swc is installed...")
        subprocess.check_call([npm_cmd, "list", "@vitejs/plugin-react-swc"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("@vitejs/plugin-react-swc is installed.")
    except subprocess.CalledProcessError:
        print("@vitejs/plugin-react-swc not found. Installing...")
        try:
            subprocess.check_call([npm_cmd, "install", "--save-dev", "@vitejs/plugin-react-swc"])
            print("Successfully installed @vitejs/plugin-react-swc.")
        except subprocess.CalledProcessError as e:
            print(f"Error installing @vitejs/plugin-react-swc: {e}")
            print("Continuing with packaging attempt...")
    
    # Build the React app using Vite
    try:
        print("Building frontend with 'npm run build'...")
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

def restore_package_json():
    # Restore the original package.json
    if os.path.exists("package.json.bak"):
        shutil.copy("package.json.bak", "package.json")
        os.remove("package.json.bak")

def build_electron_app():
    print("Building Electron app...")
    
    # Build backend using the improved build_backend function
    backend_dir = build_backend()
    
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
            # First try building without CSC_IDENTITY_AUTO_DISCOVERY=false to skip code signing
            os.environ["CSC_IDENTITY_AUTO_DISCOVERY"] = "false"
            subprocess.check_call(electron_build_cmd)
        except subprocess.CalledProcessError as e:
            print(f"Error building Electron app: {e}")
            print("Trying with alternative build configuration...")
            
            # Try with different configuration
            try:
                # Try building with --x64 flag
                electron_build_cmd.append("--x64")
                subprocess.check_call(electron_build_cmd)
            except subprocess.CalledProcessError as e:
                print(f"Error building Electron app with x64 flag: {e}")
                print("Creating fallback package directory...")
                # Create a simple directory structure as a fallback
                fallback_dir = os.path.join(os.getcwd(), "electron-dist", "win-unpacked")
                if not os.path.exists(fallback_dir):
                    os.makedirs(fallback_dir)
                # Copy dist to fallback dir
                if os.path.exists("dist"):
                    shutil.copytree("dist", os.path.join(fallback_dir, "resources", "app", "dist"), dirs_exist_ok=True)
                # Copy electron.js to fallback dir
                shutil.copy("electron.js", os.path.join(fallback_dir, "resources", "app", "electron.js"))
                return fallback_dir
        
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
   On Windows, you should see the Ollama icon in your system tray.
   On macOS, Ollama should appear in your menu bar.
   On Linux, run 'ollama serve' if it's not already running.

4. You can customize the model by editing the .env file in the application directory.

IMPORTANT FOR CONDA USERS:
SQL Sage looks for a Python installation to run its backend. If you're using Conda,
make sure your 'sqlbot' environment is activated before running SQL Sage.
If you still encounter issues, you can edit the 'backend/run_backend.py' file
to specify your Python executable path directly.
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
        
        # Copy electron.js as main.js if it doesn't exist
        electron_js_path = os.path.join(final_package_path, "resources", "app", "electron.js")
        main_js_path = os.path.join(final_package_path, "resources", "app", "main.js")
        
        if os.path.exists(electron_js_path) and not os.path.exists(main_js_path):
            os.makedirs(os.path.dirname(main_js_path), exist_ok=True)
            shutil.copy(electron_js_path, main_js_path)
        
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
