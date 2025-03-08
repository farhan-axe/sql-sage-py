
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;
let backendExecutablePath;

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
    // In production, use the packaged backend executable
    const platformSpecificPath = process.platform === 'win32' 
      ? 'sql-sage-backend.exe' 
      : 'sql-sage-backend';
    
    backendExecutablePath = path.join(
      process.platform === 'darwin' 
        ? path.dirname(app.getAppPath()) 
        : app.getAppPath(),
      '../backend',
      platformSpecificPath
    );
    
    if (!fs.existsSync(backendExecutablePath)) {
      console.error(`Backend executable not found at ${backendExecutablePath}`);
      return;
    }
    
    console.log(`Starting backend from: ${backendExecutablePath}`);
    backendProcess = spawn(backendExecutablePath);
  } else {
    // In development, start the Python backend
    backendProcess = spawn('python', ['main.py']);
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
