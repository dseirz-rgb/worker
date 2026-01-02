"""
LiveKit Voice Agent - 语音助手后端服务

使用 LiveKit Agents SDK 和 Google Gemini 实现实时语音对话。
"""

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import google, silero, noise_cancellation

from config import validate_env

# 加载环境变量
load_dotenv()

# 验证必需的环境变量
validate_env()


class VoiceAssistant(Agent):
    """语音助手 Agent 类
    
    继承自 LiveKit Agent 基类，实现自定义的语音助手逻辑。
    使用 Google Gemini 作为 LLM 后端，支持实时语音对话。
    """
    
    def __init__(self) -> None:
        super().__init__(
            instructions="""你是一个友好的语音助手。
            请用简洁、自然的方式回答用户的问题。
            保持对话流畅，像朋友一样交流。
            
            注意事项：
            - 回答要简洁明了，适合语音交互
            - 避免过长的回复，保持对话节奏
            - 使用口语化的表达方式
            - 如果不确定，可以礼貌地询问用户"""
        )


# 创建 Agent 服务器实例
server = AgentServer()


@server.rtc_session()
async def voice_agent(ctx: agents.JobContext):
    """处理 RTC 会话的主函数
    
    当用户连接到 LiveKit 房间时，此函数会被调用。
    它创建一个 AgentSession 并启动语音助手。
    
    Args:
        ctx: LiveKit JobContext，包含房间信息和连接上下文
    """
    # 创建 Agent 会话
    session = AgentSession(
        # 使用 Google Gemini 实时语音模型
        # 支持 Live API 的模型:
        # - gemini-2.5-flash-native-audio-preview-12-2025 (最新)
        # - gemini-2.5-flash-native-audio-preview-09-2025
        llm=google.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",  # 支持 Live API
            voice="Puck",  # 使用 Puck 语音
            temperature=0.8,  # 适度的创造性
        ),
        # 使用 Silero VAD 进行语音活动检测
        vad=silero.VAD.load(),
    )
    
    # 启动会话
    await session.start(
        room=ctx.room,
        agent=VoiceAssistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                # 启用噪声消除
                noise_cancellation=noise_cancellation.BVC(),
            ),
        ),
    )
    
    # 生成初始问候语
    await session.generate_reply(
        instructions="用友好的方式问候用户，告诉他们你可以帮助他们。保持简短自然。"
    )


if __name__ == "__main__":
    # 运行 Agent 服务
    agents.cli.run_app(server)
