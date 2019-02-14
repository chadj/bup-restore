const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeImage
} = require('electron');
const positioner = require('electron-traywindow-positioner');
const os = require('os');
const path = require('path');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

if (app.dock) {
  app.dock.hide();
}

//let win;
let mainWindow;
let appIcon;
let blurTimeoutId;

// function createWindow () {
//   // Create the browser window.
//   win = new BrowserWindow({ width: 800, height: 600, webPreferences: {nodeIntegration: false, preload: path.join(__dirname, 'preload.js'), contextIsolation: false} })
//
//   // and load the index.html of the app.
//   win.loadFile('index.html')
//
//   // Open the DevTools.
//   win.webContents.openDevTools()
//
//   // Emitted when the window is closed.
//   win.on('closed', () => {
//     // Dereference the window object, usually you would store windows
//     // in an array if your app supports multi windows, this is the time
//     // when you should delete the corresponding element.
//     win = null
//   })
// }

function toggleWindow() {
  if (blurTimeoutId) {
    clearTimeout(blurTimeoutId);
    blurTimeoutId = undefined;
  }
  if (!mainWindow) {
    mainWindow = new BrowserWindow({
      width: 550,
      height: 500,
      skipTaskbar: true,
      show: false,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload-launcher'),
        contextIsolation: false
      }
    })
    mainWindow.once('ready-to-show', () => {
      positioner.position(mainWindow, appIcon.getBounds());
      mainWindow.show();
      mainWindow.focus();
    });

    mainWindow.loadFile('./src/index.html');

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();

    mainWindow.on('blur', () => {
      blurTimeoutId = setTimeout(() => {
        mainWindow.hide();
        blurTimeoutId = undefined
      }, 200);
    });

    mainWindow.on('closed', function() {
      mainWindow = null
    })
  } else if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    positioner.position(mainWindow, appIcon.getBounds());
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  const iconPath = path.resolve(__dirname, '..', 'iconTemplate.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  appIcon = new Tray(trayIcon);

  if (os.platform() !== 'darwin') {
    const contextMenu = Menu.buildFromTemplate([{
      label: 'Exit',
      type: 'normal',
      click: () => {
        app.quit()
      }
    }]);

    appIcon.setContextMenu(contextMenu);
  } else {
    appIcon.setIgnoreDoubleClickEvents(true);
  }

  appIcon.on('click', toggleWindow);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createTray)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  //if (process.platform !== 'darwin') {
  //  app.quit()
  //}
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  //if (win === null) {
  //  createWindow()
  //}
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


function selectRestoreDirectory(callback) {
  dialog.showOpenDialog(mainWindow, {
    title: 'Select Restore Location',
    message: 'Select Restore Location',
    buttonLabel: 'Restore Location',
    properties: ['openDirectory', 'createDirectory']
  }, callback);
}

function quitApp() {
  app.quit();
}


exports.quitApp = quitApp;
exports.selectRestoreDirectory = selectRestoreDirectory;
