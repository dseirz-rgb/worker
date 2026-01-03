#!/usr/bin/env python3
"""
Janitor Sidecar 入口点
专为 Tauri 桌面应用设计的轻量级入口

启动方式:
    ./janitor-{target}              # 默认端口 8766
    ./janitor-{target} --port 8800  # 自定义端口
"""

import os
import sys
import argparse
import signal
import logging
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("janitor")


def setup_environment():
    """设置运行环境"""
    # 如果是打包后的可执行文件，设置正确的工作目录
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后的路径
        base_path = Path(sys._MEIPASS)
        os.chdir(base_path)
        logger.info(f"运行目录: {base_path}")
    else:
        base_path = Path(__file__).parent
    
    # 加载环境变量
    env_file = base_path / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        logger.info(f"已加载环境变量: {env_file}")
    
    return base_path


def signal_handler(signum, frame):
    """信号处理器"""
    logger.info("收到终止信号，正在关闭...")
    sys.exit(0)


def main():
    """主入口"""
    parser = argparse.ArgumentParser(
        description="Echo Janitor Sidecar - 文件整理服务"
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=int(os.getenv("JANITOR_PORT", "8766")),
        help="服务端口 (默认: 8766)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=os.getenv("JANITOR_HOST", "127.0.0.1"),
        help="绑定地址 (默认: 127.0.0.1)"
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="info",
        choices=["debug", "info", "warning", "error"],
        help="日志级别"
    )
    parser.add_argument(
        "--version", "-v",
        action="store_true",
        help="显示版本信息"
    )
    
    args = parser.parse_args()
    
    if args.version:
        print("Echo Janitor Sidecar v1.0.0")
        return
    
    # 设置信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 设置环境
    setup_environment()
    
    # 设置日志级别
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper()))
    
    logger.info("=" * 50)
    logger.info("🧹 Echo Janitor Sidecar 启动中...")
    logger.info(f"   地址: http://{args.host}:{args.port}")
    logger.info("=" * 50)
    
    try:
        import uvicorn
        from server import app
        
        uvicorn.run(
            app,
            host=args.host,
            port=args.port,
            log_level=args.log_level,
            access_log=args.log_level == "debug"
        )
    except ImportError as e:
        logger.error(f"导入错误: {e}")
        logger.error("请确保已安装所有依赖: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        logger.error(f"启动失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
