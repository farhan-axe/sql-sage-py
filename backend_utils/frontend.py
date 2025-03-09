
"""
Module for frontend building operations.
"""
import os
import subprocess
from .npm import find_npm

def build_frontend():
    """Build the frontend Vite app."""
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
