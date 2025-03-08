
import os
import sys
import shutil
import subprocess

def build_backend():
    print("Building SQL Sage Backend...")
    
    # Create the build directory if it doesn't exist
    if not os.path.exists("dist"):
        os.makedirs("dist")
    
    # Install PyInstaller if not already installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    # Create the spec file for PyInstaller
    spec_content = """
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[('.env', '.')],
    hiddenimports=['uvicorn.logging', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='sql-sage-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='public/favicon.ico',
)
"""
    
    with open("sql_sage.spec", "w") as f:
        f.write(spec_content)
    
    # Build the executable
    print("Building executable with PyInstaller...")
    subprocess.check_call(["pyinstaller", "sql_sage.spec", "--clean"])
    
    print("Backend build complete!")
    return os.path.join("dist", "sql-sage-backend")

if __name__ == "__main__":
    build_backend()
