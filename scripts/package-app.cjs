'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const release = path.join(root, 'release');
const stage = path.join(release, '.build', require('../package.json').version);
fs.mkdirSync(stage, { recursive: true });

function run(args, cwd, extraEnv = {}) {
    const child = spawnSync(process.execPath, args, {
        cwd, env: { ...process.env, ...extraEnv }, windowsHide: true, stdio: 'inherit'
    });
    if (child.error) throw child.error;
    if (child.status !== 0) process.exit(child.status ?? 1);
}

// Vite and runtime builds must never inherit the developer's mock API mode.
if (!process.argv.includes('--skip-frontend')) {
    run([path.join(root, 'Frontend/node_modules/vite/bin/vite.js'), 'build'], path.join(root, 'Frontend'), {
        VITE_USE_MOCK: 'false', VITE_API_URL: ''
    });
}
if (!fs.existsSync(path.join(root, 'Frontend/dist/index.html'))) throw new Error('Frontend production build is missing.');

for (const entry of ['API', 'database', 'CRWEB', 'electron', 'assets/branding', 'Frontend/dist', 'index.js', 'package.json', 'package-lock.json', 'electron-builder.config.cjs']) {
    const source = path.join(root, entry), destination = path.join(stage, entry);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, {
        recursive: true,
        filter: file => {
            const relative = path.relative(source, file);
            const basename = path.basename(file);
            if (!relative && fs.statSync(file).isDirectory()) return true;
            return !/(^|[\\/])(tests|node_modules)([\\/]|$)/.test(relative)
                && !/^\.env/.test(basename) && basename !== 'cookie.txt'
                && !/\.(db|sqlite|sqlite3|log)(-|$)/i.test(basename);
        }
    });
}

const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!fs.existsSync(path.join(stage, 'node_modules/electron-builder/cli.js'))) {
    run([npmCli, 'ci', '--no-audit', '--no-fund'], stage);
} else {
    run([npmCli, 'install', '--no-audit', '--no-fund'], stage);
}
run([path.join(stage, 'node_modules/electron-builder/cli.js'), '--config', path.join(stage, 'electron-builder.config.cjs'), '--win', ...(process.argv.includes('--dir') ? ['--dir'] : ['nsis', 'portable']), '--x64', '--publish', 'never'], stage, {
    SMART_STUDY_RELEASE_DIR: release,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false'
});
