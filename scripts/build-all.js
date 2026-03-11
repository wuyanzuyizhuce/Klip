const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Klip 终极自动化打包脚本 v2.0
 * 功能：清理 -> 构建 -> 签名(可选) -> 生成 DMG (macOS)
 */

const APP_NAME = 'Klip';
const log = (msg) => console.log(`\n\x1b[36m🚀 [${APP_NAME}-Build]\x1b[0m ${msg}`);
const success = (msg) => console.log(`\n\x1b[32m✅ [Success]\x1b[0m ${msg}`);
const error = (msg) => console.log(`\n\x1b[31m❌ [Error]\x1b[0m ${msg}`);

async function build() {
  const startTime = Date.now();
  try {
    const platform = process.platform;
    const arch = process.arch; // arm64 or x64
    log(`启动打包流程 | 平台: ${platform} | 架构: ${arch}`);

    // 1. 环境准备
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'; // 默认跳过正式签名，使用 Ad-hoc
    process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/';

    // 2. 清理旧产物
    log('正在清理历史构建产物...');
    ['dist', 'out'].forEach(dir => {
      const dirPath = path.join(__dirname, '..', dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    });

    // 3. 运行构建
    log('正在执行代码编译与类型检查 (electron-vite build)...');
    execSync('npm run build', { stdio: 'inherit' });

    // 4. 打包为应用文件夹 (.app)
    log('正在打包应用包 (electron-builder)...');
    if (platform === 'darwin') {
      execSync('npx electron-builder --mac --dir', { stdio: 'inherit' });
      
      // 5. 将 .app 转换为 .dmg
      log('正在生成 DMG 安装镜像 (electron-installer-dmg)...');
      const appPath = path.join(__dirname, '../dist', `mac-${arch}`, `${APP_NAME.toLowerCase()}.app`);
      const dmgPath = path.join(__dirname, '../dist', `${APP_NAME}.dmg`);
      
      // 使用 npx 运行，确保不需要手动安装工具
      const dmgCmd = `npx electron-installer-dmg "${appPath}" "${APP_NAME}" ` +
                     `--out=dist --icon=resources/icon.png --overwrite`;
      
      execSync(dmgCmd, { stdio: 'inherit' });
    } else if (platform === 'win32') {
      execSync('npx electron-builder --win', { stdio: 'inherit' });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    success(`所有任务已完成！耗时: ${duration}s`);
    success(`最终产物位置: ${path.join(__dirname, '../dist/', platform === 'darwin' ? APP_NAME + '.dmg' : '')}`);

  } catch (err) {
    error('打包过程中出现致命错误：');
    console.error(err);
    process.exit(1);
  }
}

build();
