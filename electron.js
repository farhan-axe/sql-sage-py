
const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
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
  console.log("Searching for Python installation...");
  
  // Try to find Python in common locations
  const pythonCommands = ['python', 'python3', 'py'];
  
  // For Windows, add potential full paths
  if (process.platform === 'win32') {
    // Add common Windows Python installation paths
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || 'C:\\Users\\Default\\AppData\\Local';
    
    // Add Python launcher which should be in PATH if Python is installed
    pythonCommands.push('py.exe');
    
    // Add standard installation paths
    for (const base of [programFiles, programFilesX86]) {
      pythonCommands.push(
        path.join(base, 'Python38', 'python.exe'),
        path.join(base, 'Python39', 'python.exe'),
        path.join(base, 'Python310', 'python.exe'),
        path.join(base, 'Python311', 'python.exe'),
        path.join(base, 'Python312', 'python.exe')
      );
    }
    
    // Add Microsoft Store Python installations
    pythonCommands.push(
      path.join(localAppData, 'Programs', 'Python', 'Python38', 'python.exe'),
      path.join(localAppData, 'Programs', 'Python', 'Python39', 'python.exe'),
      path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe'),
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe')
    );
    
    // Check if Python is in PATH via 'where' command
    try {
      const whereOutput = execSync('where python').toString().trim().split('\n')[0];
      if (whereOutput && !pythonCommands.includes(whereOutput)) {
        pythonCommands.push(whereOutput);
        console.log(`Found Python in PATH: ${whereOutput}`);
      }
    } catch (e) {
      console.log("Python not found in PATH");
    }
  } else {
    // On Unix systems, try to use 'which' to find Python
    try {
      const whichOutput = execSync('which python3 || which python').toString().trim();
      if (whichOutput && !pythonCommands.includes(whichOutput)) {
        pythonCommands.push(whichOutput);
        console.log(`Found Python via 'which': ${whichOutput}`);
      }
    } catch (e) {
      console.log("Python not found using 'which'");
    }
  }
  
  // Check bundled Python if app is packaged
  if (app.isPackaged) {
    const bundledPython = path.join(path.dirname(app.getPath('exe')), 'python', 'python.exe');
    if (fs.existsSync(bundledPython)) {
      console.log(`Found bundled Python: ${bundledPython}`);
      pythonCommands.unshift(bundledPython);  // Prioritize bundled Python
    }
  }
  
  console.log(`Checking these Python paths: ${pythonCommands.join(', ')}`);
  
  // Try each command
  for (const cmd of pythonCommands) {
    try {
      if (!fs.existsSync(cmd) && cmd.includes(path.sep)) {
        console.log(`Skipping non-existent path: ${cmd}`);
        continue;
      }
      
      console.log(`Testing Python path: ${cmd}`);
      const result = require('child_process').spawnSync(cmd, ['--version']);
      if (result.status === 0) {
        const version = result.stdout.toString().trim() || result.stderr.toString().trim();
        console.log(`Found working Python: ${cmd} - ${version}`);
        return cmd;
      } else {
        console.log(`Python path ${cmd} exists but returned status ${result.status}`);
      }
    } catch (e) {
      console.log(`Error testing ${cmd}: ${e.message}`);
    }
  }
  
  // If we get here, we couldn't find Python - throw an error
  throw new Error("Could not find a working Python installation. Please install Python and make sure it's in your PATH.");
}

function startBackend() {
  try {
    // Try to find a working Python installation
    const pythonPath = findPythonPath();
    console.log(`Using Python: ${pythonPath}`);

    // Get backend directory (relative to app location)
    let backendDir;
    const possibleBackendLocations = [];
    
    if (app.isPackaged) {
      // In packaged app, try various locations
      possibleBackendLocations.push(
        // Relative to executable
        path.join(path.dirname(app.getPath('exe')), 'backend'),
        // Relative to app path
        path.join(app.getAppPath(), '..', 'backend'),
        // Inside app directory
        path.join(app.getAppPath(), 'backend'),
        // Resources directory
        path.join(app.getAppPath(), '..', 'resources', 'backend'),
        // One level up from project root
        path.join(app.getAppPath(), '..', '..', 'backend')
      );
    } else {
      // In development, try various locations
      possibleBackendLocations.push(
        // Backend inside current directory
        path.join(app.getAppPath(), 'backend'),
        // Backend next to frontend
        path.join(path.dirname(app.getAppPath()), 'backend'),
        // Backend in parent directory
        path.join(path.dirname(path.dirname(app.getAppPath())), 'backend')
      );
    }
    
    console.log("Checking possible backend locations:");
    for (const location of possibleBackendLocations) {
      console.log(`- ${location}`);
      if (fs.existsSync(location)) {
        backendDir = location;
        console.log(`Found backend at: ${backendDir}`);
        break;
      }
    }

    if (!backendDir) {
      throw new Error(`Backend directory not found. Checked: ${possibleBackendLocations.join(', ')}`);
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
      env.PYTHONPATH = backendDir + (env.PYTHONPATH ? `;${env.PYTHONPATH}` : '');
    } else {
      env.PATH = `${backendDir}:${env.PATH}`;
      env.PYTHONPATH = backendDir + (env.PYTHONPATH ? `:${env.PYTHONPATH}` : '');
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
      dialog.showErrorBox(
        'Error Starting Backend',
        `Failed to start SQL Sage backend: ${error.message}\n\n` +
        'Please make sure Python is installed and in your PATH.\n' + 
        'If Python is installed, try running the backend manually by opening a terminal in the "backend" directory and running:\n' +
        'python sql.py'
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
