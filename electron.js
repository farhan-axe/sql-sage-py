
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

function startBackend() {
  if (app.isPackaged) {
    // Get the path to the Python interpreter
    let pythonPath = 'python';  // Default to system Python
    
    // In production, use the launcher script
    const backendDir = path.join(
      process.platform === 'darwin' 
        ? path.dirname(app.getAppPath()) 
        : app.getAppPath(),
      '../backend'
    );
    
    // Determine which file to run
    const launcherPath = path.join(backendDir, 'run_backend.py');
    const sqlPath = path.join(backendDir, 'sql.py');
    
    const scriptToRun = fs.existsSync(launcherPath) ? launcherPath : sqlPath;
    
    console.log(`Starting backend from: ${scriptToRun}`);
    backendProcess = spawn(pythonPath, [scriptToRun], {
      cwd: backendDir  // Set working directory to backend folder
    });
  } else {
    // In development, start the Python backend
    // Locate the backend one directory up, then in 'backend' folder
    const backendDir = path.join(path.dirname(app.getAppPath()), 'backend');
    const sqlPath = path.join(backendDir, 'sql.py');
    
    console.log(`Starting backend from: ${sqlPath}`);
    backendProcess = spawn('python', [sqlPath], {
      cwd: backendDir  // Set working directory to backend folder
    });
  }

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend output: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend error: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

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
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      backendProcess.kill();
    }
  }
});
