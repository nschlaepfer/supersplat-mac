const path = require('path');
const { app, BrowserWindow, Menu, shell } = require('electron');

const isDevtoolsEnabled = process.env.ELECTRON_DEVTOOLS === 'true';
const APP_TITLE = 'SuperSplat Vision Pro';

const getContentRoot = () => app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');

const createMenu = () => {
    const template = [
        {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reveal Samples Folder',
                    click: () => {
                        shell.openPath(path.join(getContentRoot(), 'samples'));
                    }
                },
                { type: 'separator' },
                { role: 'close' }
            ]
        },
        {
            role: 'viewMenu'
        },
        {
            role: 'windowMenu'
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'SuperSplat Docs',
                    click: () => shell.openExternal('https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/')
                },
                {
                    label: 'Vision Pro Workflow Notes',
                    click: () => shell.openPath(path.join(getContentRoot(), 'docs', 'm3-max-vision-pro.md'))
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1280,
        minHeight: 720,
        backgroundColor: '#050505',
        title: APP_TITLE,
        trafficLightPosition: { x: 14, y: 14 },
        webPreferences: {
            contextIsolation: true,
            sandbox: false,
            nodeIntegration: false
        }
    });

    const presetQuery = 'preset=apple-m3-max';
    const startUrl = process.env.ELECTRON_START_URL;
    if (startUrl && startUrl.startsWith('http')) {
        const url = `${startUrl}${startUrl.includes('?') ? '&' : '?'}${presetQuery}`;
        win.loadURL(url);
    } else {
        const filePath = startUrl || path.join(getContentRoot(), 'dist', 'index.html');
        win.loadFile(filePath, { search: `?${presetQuery}` });
    }

    if (isDevtoolsEnabled) {
        win.webContents.openDevTools({ mode: 'detach' });
    }

    return win;
};

app.name = APP_TITLE;

app.whenReady().then(() => {
    createMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
