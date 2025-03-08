
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'public/favicon.ico')
  });

  // Check if we're in development or production mode
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function findPythonPath() {
  // Try to find Python in common locations
  const pythonCommands = ['python', 'python3', 'py'];
  
  // For Windows, add potential full paths
  if (process.platform === 'win32') {
    // Add common Windows Python installation paths
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    
    for (const base of [programFiles, programFilesX86]) {
      pythonCommands.push(
        path.join(base, 'Python38', 'python.exe'),
        path.join(base, 'Python39', 'python.exe'),
        path.join(base, 'Python310', 'python.exe'),
        path.join(base, 'Python311', 'python.exe'),
        path.join(base, 'Python312', 'python.exe')
      );
    }
  }
  
  // Try each command
  for (const cmd of pythonCommands) {
    try {
      const result = require('child_process').spawnSync(cmd, ['--version']);
      if (result.status === 0) {
        console.log(`Found Python: ${cmd} - ${result.stdout.toString().trim()}`);
        return cmd;
      }
    } catch (e) {
      // This command failed, try the next one
    }
  }
  
  // If we get here, we couldn't find Python - use a default and hope for the best
  console.warn("Could not find Python. Using default 'python' command.");
  return process.platform === 'win32' ? 'python.exe' : 'python';
}

function startBackend() {
  try {
    // Find the right Python command
    const pythonPath = findPythonPath();
    console.log(`Using Python: ${pythonPath}`);

    // Get backend directory (relative to app location)
    let backendDir;
    if (app.isPackaged) {
      // In packaged app, backend should be in a 'backend' directory next to the executable
      backendDir = path.join(path.dirname(app.getPath('exe')), 'backend');
      
      // If that fails, try looking relative to app path
      if (!fs.existsSync(backendDir)) {
        backendDir = path.join(app.getAppPath(), '..', 'backend');
      }
      
      // If that fails too, try looking inside app directory
      if (!fs.existsSync(backendDir)) {
        backendDir = path.join(app.getAppPath(), 'backend');
      }
    } else {
      // In development, backend should be one level up from current directory, then into 'backend'
      backendDir = path.join(path.dirname(app.getAppPath()), 'backend');
    }

    console.log(`Looking for backend at: ${backendDir}`);
    
    if (!fs.existsSync(backendDir)) {
      console.error(`Backend directory not found at ${backendDir}`);
      throw new Error(`Backend directory not found at ${backendDir}`);
    }

    // Determine which file to run (run_backend.py or sql.py)
    let scriptPath;
    const runBackendPath = path.join(backendDir, 'run_backend.py');
    const sqlPath = path.join(backendDir, 'sql.py');
    
    if (fs.existsSync(runBackendPath)) {
      scriptPath = runBackendPath;
    } else if (fs.existsSync(sqlPath)) {
      scriptPath = sqlPath;
    } else {
      throw new Error(`Neither run_backend.py nor sql.py found in ${backendDir}`);
    }

    console.log(`Starting backend from: ${scriptPath}`);
    
    // Add backend directory to PATH so Python can find modules
    const env = { ...process.env };
    if (process.platform === 'win32') {
      env.PATH = `${backendDir};${env.PATH}`;
    } else {
      env.PATH = `${backendDir}:${env.PATH}`;
    }
    
    // Spawn the process with the enhanced environment
    backendProcess = spawn(pythonPath, [scriptPath], {
      cwd: backendDir,  // Set working directory to backend folder
      env: env,
      stdio: 'pipe',    // Capture output
      windowsHide: false // Make the console window visible on Windows
    });

    // Handle backend process output
    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend output: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend error: ${data}`);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      if (code !== 0 && mainWindow) {
        // Show error dialog
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Backend Error',
          `The SQL Sage backend process exited unexpectedly with code ${code}.\n\n` +
          'Please make sure Python is installed and check that Ollama is running.'
        );
      }
    });
    
    backendProcess.on('error', (err) => {
      console.error(`Failed to start backend: ${err}`);
      if (mainWindow) {
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Backend Error',
          `Failed to start the SQL Sage backend: ${err.message}\n\n` +
          'Please make sure Python is installed and check that Ollama is running.'
        );
      }
    });
  } catch (error) {
    console.error(`Error starting backend: ${error.message}`);
    if (mainWindow) {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Error Starting Backend',
        `Failed to start SQL Sage backend: ${error.message}\n\n` +
        'Please make sure Python is installed and check that Ollama is running.'
      );
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  startBackend();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Kill the backend process when the app is closing
  if (backendProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
      } else {
        backendProcess.kill();
      }
    } catch (err) {
      console.error(`Error killing backend process: ${err}`);
    }
  }
});
