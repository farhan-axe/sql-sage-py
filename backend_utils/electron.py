
"""
Module for Electron-related packaging operations.
"""
import os
import shutil
import subprocess
import platform
from .build import build_backend
from .npm import find_npm

def setup_electron():
    """Set up Electron packaging environment."""
    print("Setting up Electron packaging...")
    
    # Copy the electron package.json to package.json.bak to use for building
    if os.path.exists("package.json.bak"):
        os.remove("package.json.bak")
    
    shutil.copy("package.json", "package.json.bak")
    shutil.copy("electron-package.json", "package.json")
    
    # Add PYTHON_EXECUTABLE environment variable to package.json
    try:
        import json
        with open("package.json", "r") as f:
            package_json = json.load(f)
        
        # Add build configuration if it doesn't exist
        if "build" not in package_json:
            package_json["build"] = {}
        
        # Add environment variables if they don't exist
        if "extraResources" not in package_json["build"]:
            package_json["build"]["extraResources"] = []
        
        # Update the package.json file
        with open("package.json", "w") as f:
            json.dump(package_json, f, indent=2)
        
        print("Updated package.json with Python executable path")
    except Exception as e:
        print(f"Warning: Could not update package.json: {e}")

def restore_package_json():
    """Restore the original package.json after Electron packaging."""
    # Restore the original package.json
    if os.path.exists("package.json.bak"):
        shutil.copy("package.json.bak", "package.json")
        os.remove("package.json.bak")

def build_electron_app():
    """Build the Electron app package."""
    print("Building Electron app...")
    
    # Hardcoded Python path
    hardcoded_python_path = r"C:\Users\farha\anaconda3\envs\sqlbot\python.exe"
    print(f"Using hardcoded Python path for Electron app: {hardcoded_python_path}")
    
    # Set PYTHON_EXECUTABLE environment variable for the Electron build process
    os.environ["PYTHON_EXECUTABLE"] = hardcoded_python_path
    
    # Build backend using the improved build_backend function
    backend_dir = build_backend()
    
    # Create a config file in the backend directory with the Python path
    config_file = os.path.join(backend_dir, "python_config.json")
    try:
        import json
        with open(config_file, "w") as f:
            json.dump({"python_path": hardcoded_python_path}, f, indent=2)
        print(f"Created Python config file: {config_file}")
    except Exception as e:
        print(f"Warning: Could not create Python config file: {e}")
    
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
            # Set the PYTHON_EXECUTABLE environment variable
            os.environ["PYTHON_EXECUTABLE"] = hardcoded_python_path
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
                
                # Create a config file with the Python path
                resources_app_dir = os.path.join(fallback_dir, "resources", "app")
                os.makedirs(resources_app_dir, exist_ok=True)
                config_file = os.path.join(resources_app_dir, "python_config.json")
                try:
                    import json
                    with open(config_file, "w") as f:
                        json.dump({"python_path": hardcoded_python_path}, f, indent=2)
                    print(f"Created Python config file in fallback dir: {config_file}")
                except Exception as e:
                    print(f"Warning: Could not create Python config file in fallback dir: {e}")
                
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
