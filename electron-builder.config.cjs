'use strict';

module.exports = {
    appId: 'vn.cmcu.smartstudyhub',
    productName: 'Smart Study Hub',
    copyright: 'Copyright © 2026 Smart Study Hub contributors',
    asar: true,
    asarUnpack: ['node_modules/sql.js/dist/*.wasm'],
    npmRebuild: false,
    directories: { output: process.env.SMART_STUDY_RELEASE_DIR || 'release', buildResources: 'assets/branding' },
    files: [
        'package.json', 'index.js', 'electron/**/*', 'API/**/*', 'database/**/*', 'CRWEB/modules/**/*', 'CRWEB/shared/**/*',
        'Frontend/dist/**/*', '!**/tests/**', '!**/*.test.*', '!**/.env*', '!**/cookie.txt', '!**/*.db', '!**/*.sqlite*',
        '!**/*.log', '!data/**', '!docs/**', '!scripts/**'
    ],
    extraResources: [{ from: 'assets/branding', to: 'branding', filter: ['smart-study-hub.ico', 'smart-study-hub.png'] }],
    win: {
        target: [{ target: 'nsis', arch: ['x64'] }, { target: 'portable', arch: ['x64'] }],
        icon: 'assets/branding/smart-study-hub.ico',
        executableName: 'SmartStudyHub',
        requestedExecutionLevel: 'asInvoker'
    },
    nsis: {
        artifactName: 'Smart-Study-Hub-${version}-Setup-x64.${ext}',
        oneClick: true, perMachine: false, allowElevation: false,
        createDesktopShortcut: true, createStartMenuShortcut: true,
        shortcutName: 'Smart Study Hub', runAfterFinish: true,
        deleteAppDataOnUninstall: false
    },
    portable: { artifactName: 'Smart-Study-Hub-${version}-Portable-x64.${ext}', requestExecutionLevel: 'user' },
    publish: null
};
