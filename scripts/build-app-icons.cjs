'use strict';

// Format/size exports only: the artwork is the unchanged ImageGen PNG master.
const electron = require('electron');
const { spawnSync } = require('node:child_process');
if (!electron.app) {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exit(child.status ?? 1);
}

const { app, nativeImage } = electron;
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const branding = path.join(root, 'assets', 'branding');
const publicBrand = path.join(root, 'Frontend', 'public', 'brand');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-study-icon-export-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();

app.whenReady().then(() => {
    let status = 0;
    try {
        const master = nativeImage.createFromPath(path.join(branding, 'smart-study-hub.png'));
        if (master.isEmpty()) throw new Error('The branding PNG master could not be decoded.');
        const dimensions = master.getSize();
        if (dimensions.width !== dimensions.height) throw new Error('The branding master must be square.');
        fs.mkdirSync(publicBrand, { recursive: true });
        const png = size => master.resize({ width: size, height: size, quality: 'best' }).toPNG();
        const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
        const images = sizes.map(png);
        const header = Buffer.alloc(6 + 16 * sizes.length);
        header.writeUInt16LE(1, 2); // ICO image type.
        header.writeUInt16LE(sizes.length, 4);
        let offset = header.length;
        images.forEach((data, index) => {
            const entry = 6 + index * 16;
            header[entry] = sizes[index] === 256 ? 0 : sizes[index];
            header[entry + 1] = header[entry];
            header.writeUInt16LE(1, entry + 4);
            header.writeUInt16LE(32, entry + 6);
            header.writeUInt32LE(data.length, entry + 8);
            header.writeUInt32LE(offset, entry + 12);
            offset += data.length;
        });
        const icon = path.join(branding, 'smart-study-hub.ico');
        fs.writeFileSync(icon, Buffer.concat([header, ...images]));
        fs.writeFileSync(path.join(publicBrand, 'app-icon.png'), png(512));
        fs.writeFileSync(path.join(publicBrand, 'favicon-32.png'), png(32));
        fs.writeFileSync(path.join(publicBrand, 'apple-touch-icon.png'), png(180));
        if (nativeImage.createFromPath(icon).isEmpty()) throw new Error('Electron could not read the exported ICO.');
        console.log(JSON.stringify({ master: dimensions, icoSizes: sizes, publicSizes: [512, 32, 180], icoDecodedByElectron: true }, null, 2));
    } catch (error) {
        status = 1;
        console.error(error);
    } finally {
        const target = path.resolve(profile);
        if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('smart-study-icon-export-')) {
            try { fs.rmSync(target, { recursive: true, force: true }); } catch { /* Chromium may briefly retain a file handle. */ }
        }
        app.exit(status);
    }
});
