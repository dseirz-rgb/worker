#!/usr/bin/env python3
"""
Janitor Sidecar 打包脚本
使用 PyInstaller 将 Janitor 打包为独立可执行文件

用法:
    python build_sidecar.py           # 打包当前平台
    python build_sidecar.py --all     # 打包所有平台 (需要在对应平台上运行)
"""

import os
import sys
import platform
import subprocess
import shutil
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent
DIST_DIR = PROJECT_ROOT / "dist"
BUILD_DIR = PROJECT_ROOT / "build"

# Tauri sidecar 输出目录
TAURI_BINARIES_DIR = PROJECT_ROOT.parent.parent.parent / "get" / "blinko-main" / "src-tauri" / "binaries"


def get_target_triple():
    """获取当前平台的 target triple"""
    system = platform.system().lower()
    machine = platform.machine().lower()
    
    if system == "darwin":
        if machine == "arm64":
            return "aarch64-apple-darwin"
        else:
            return "x86_64-apple-darwin"
    elif system == "windows":
        return "x86_64-pc-windows-msvc"
    elif system == "linux":
        if machine == "aarch64":
            return "aarch64-unknown-linux-gnu"
        else:
            return "x86_64-unknown-linux-gnu"
    else:
        raise RuntimeError(f"不支持的平台: {system} {machine}")


def get_executable_name(target_triple: str) -> str:
    """获取可执行文件名称"""
    base_name = "janitor"
    if "windows" in target_triple:
        return f"{base_name}-{target_triple}.exe"
    else:
        return f"{base_name}-{target_triple}"


def clean_build():
    """清理构建目录"""
    print("🧹 清理构建目录...")
    for dir_path in [DIST_DIR, BUILD_DIR]:
        if dir_path.exists():
            shutil.rmtree(dir_path)
    print("✅ 清理完成")


def install_dependencies():
    """安装依赖"""
    print("📦 安装依赖...")
    subprocess.run([
        sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "-q"
    ], cwd=PROJECT_ROOT, check=True)
    subprocess.run([
        sys.executable, "-m", "pip", "install", "pyinstaller", "-q"
    ], cwd=PROJECT_ROOT, check=True)
    print("✅ 依赖安装完成")


def build_executable():
    """构建可执行文件"""
    target_triple = get_target_triple()
    exe_name = get_executable_name(target_triple)
    
    print(f"🔨 构建 {exe_name}...")
    
    # PyInstaller 参数
    pyinstaller_args = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",                    # 单文件模式
        "--name", "janitor",            # 输出名称
        "--clean",                      # 清理临时文件
        "--noconfirm",                  # 不确认覆盖
        # 添加数据文件
        "--add-data", f"src{os.pathsep}src",
        "--add-data", f"config{os.pathsep}config",
        # 隐藏导入
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        # 入口点
        "server.py"
    ]
    
    # macOS 特定选项
    if platform.system() == "Darwin":
        pyinstaller_args.extend([
            "--target-architecture", "arm64" if "aarch64" in target_triple else "x86_64"
        ])
    
    subprocess.run(pyinstaller_args, cwd=PROJECT_ROOT, check=True)
    
    # 重命名输出文件
    src_exe = DIST_DIR / ("janitor.exe" if "windows" in target_triple else "janitor")
    dst_exe = DIST_DIR / exe_name
    
    if src_exe.exists():
        shutil.move(str(src_exe), str(dst_exe))
        print(f"✅ 构建完成: {dst_exe}")
        return dst_exe
    else:
        raise RuntimeError(f"构建失败: 找不到输出文件 {src_exe}")


def copy_to_tauri():
    """复制到 Tauri binaries 目录"""
    target_triple = get_target_triple()
    exe_name = get_executable_name(target_triple)
    src_exe = DIST_DIR / exe_name
    
    if not src_exe.exists():
        print(f"⚠️ 找不到可执行文件: {src_exe}")
        return
    
    # 确保目标目录存在
    TAURI_BINARIES_DIR.mkdir(parents=True, exist_ok=True)
    
    dst_exe = TAURI_BINARIES_DIR / exe_name
    shutil.copy2(str(src_exe), str(dst_exe))
    
    # 设置可执行权限 (Unix)
    if platform.system() != "Windows":
        os.chmod(dst_exe, 0o755)
    
    print(f"✅ 已复制到 Tauri: {dst_exe}")


def main():
    """主函数"""
    import argparse
    parser = argparse.ArgumentParser(description="Janitor Sidecar 打包脚本")
    parser.add_argument("--clean", action="store_true", help="仅清理构建目录")
    parser.add_argument("--no-copy", action="store_true", help="不复制到 Tauri 目录")
    parser.add_argument("--skip-deps", action="store_true", help="跳过依赖安装")
    args = parser.parse_args()
    
    os.chdir(PROJECT_ROOT)
    
    if args.clean:
        clean_build()
        return
    
    print("=" * 60)
    print("🚀 Janitor Sidecar 打包")
    print(f"   平台: {platform.system()} {platform.machine()}")
    print(f"   Target: {get_target_triple()}")
    print("=" * 60)
    
    clean_build()
    
    if not args.skip_deps:
        install_dependencies()
    
    build_executable()
    
    if not args.no_copy:
        copy_to_tauri()
    
    print("\n✨ 打包完成!")


if __name__ == "__main__":
    main()
