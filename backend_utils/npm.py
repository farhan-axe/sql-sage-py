
"""
Module for npm-related operations.
"""
import platform
import subprocess
import os

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
