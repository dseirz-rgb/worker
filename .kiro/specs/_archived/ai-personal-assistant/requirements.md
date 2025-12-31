# Requirements Document - Echo

## Introduction

**Echo** 是一款多端 AI 个人助手应用（桌面 + 移动端），旨在成为用户的"AI 第二大脑"。它不仅被动响应用户请求，还能主动观察、分析、提醒，帮助用户更好地管理工作和生活。

名字寓意：Echo 会"回响"你的一切 - 记住你说的、做的、想的，在需要时回馈给你。

### 用户画像

用户是一位多角色、多领域的专业人士：
- **正职工作** - 网易美术经理，管理约10人团队
- **AI 开发爱好** - 使用 AI 辅助编程，开发个人软件
- **投资理财** - 有自己的风控系统（RiskControl），关注投资决策
- **创业项目** - 正在开发 3D AI 生成系统
- **家庭生活** - 有妻子、2岁女儿、五六十岁父母需要照顾

### 核心理念

- **记忆不丢失** - 所有想法、笔记、任务都被 AI 记住并组织
- **主动关怀** - AI 会主动提醒、反馈，甚至给出"逆耳忠言"
- **多端同步** - 桌面和移动端无缝切换，云端备份保障数据安全
- **本地优先** - 数据优先存储在本地，保证离线可用和快速响应
- **系统互联** - 与风控系统等外部系统 API 交互
- **GitHub 感知** - 了解用户在 GitHub 上的项目动态

### 参考项目

- [memU](https://github.com/NevaMind-AI/memU) - AI 记忆框架
- [Blinko](https://github.com/blinkospace/blinko) - 闪念笔记 UI
- [Pot](https://github.com/pot-app/pot-desktop) - 截图翻译
- [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) - 文件管理

## Glossary

- **Assistant**: AI 个人助手系统的核心服务
- **Memory_System**: 基于 memU 架构的 AI 记忆层，负责记忆提取、组织和检索
- **Note_Service**: 闪念笔记服务，处理快速想法捕捉
- **Task_Service**: 待办事项服务，管理任务和优先级
- **Reminder_Engine**: 主动提醒引擎，分析用户行为并生成提醒
- **Translation_Service**: 截图和划词翻译服务
- **File_Manager**: 文件管理服务，处理文档 OCR 和智能分类
- **Daily_Report**: 日报服务，生成早晚总结和建议
- **Chat_Interface**: AI 对话界面
- **External_API**: 外部系统 API 集成服务（如风控系统）
- **GitHub_Monitor**: GitHub 项目监控服务
- **Life_Domain**: 生活领域分类（工作/投资/开发/家庭）
- **Activity_Monitor**: 电脑活动监控服务，追踪应用使用和工作模式
- **Health_Integration**: Apple Health 数据集成服务
- **Emotion_Tracker**: 情绪追踪和分析服务
- **Team_Manager**: 团队管理辅助服务，追踪团队互动和管理技能提升
- **Voice_Recorder**: 语音录制和转写服务
- **Task_Delegator**: 任务分配和团队协作服务
- **Family_Care**: 家庭关怀服务，追踪家庭成员需求和互动

---

## 需求分类概览

| 分类 | 需求编号 | 描述 |
|------|---------|------|
| **A. 核心功能** | 1-9 | 笔记、任务、翻译、对话、文件、同步等基础功能 |
| **B. 工作与职业** | 10-14, 19, 23-25 | 团队管理、周报、会议记录、任务分配 |
| **C. 投资与理财** | 10, 18, 21-22 | 风控系统集成、投资学习、情绪控制 |
| **D. 学习与成长** | 16, 18, 20, 23 | AI学习、投资学习、英语学习、管理学习 |
| **E. 健康与情绪** | 17, 21-22 | 健康数据、情绪管理、工作生活平衡 |
| **F. 家庭生活** | 12, 26 | 家庭关怀、亲子互动、父母照顾 |
| **G. 系统感知** | 11, 15 | GitHub监控、电脑活动感知 |

---

## A. 核心功能 (Requirements 1-9)

### Requirement 1: 闪念笔记捕捉

**User Story:** As a user, I want to quickly capture fleeting thoughts, so that I never lose important ideas.

#### Acceptance Criteria

1. WHEN a user opens the quick capture interface, THE Note_Service SHALL display an input field within 200ms
2. WHEN a user types a note and presses Enter, THE Note_Service SHALL save the note and clear the input field
3. WHEN a user attempts to save an empty note, THE Note_Service SHALL prevent the save and show a subtle warning
4. WHEN a note is saved, THE Memory_System SHALL extract and categorize the content automatically
5. WHEN a user adds tags to a note, THE Note_Service SHALL associate the tags with the note for filtering
6. WHEN a user searches for notes, THE Memory_System SHALL return relevant results using semantic search

### Requirement 2: 待办事项管理

**User Story:** As a user, I want to manage my tasks with priorities and deadlines, so that I can stay organized and productive.

#### Acceptance Criteria

1. WHEN a user creates a task, THE Task_Service SHALL save the task with default priority "medium"
2. WHEN a user sets a deadline for a task, THE Task_Service SHALL store the deadline and enable reminder scheduling
3. WHEN a user changes task priority, THE Task_Service SHALL update the priority and reorder the task list
4. WHEN a user marks a task as complete, THE Task_Service SHALL record the completion time and update statistics
5. WHEN a task deadline approaches, THE Reminder_Engine SHALL send a notification based on user preferences
6. WHEN a user views the task list, THE Task_Service SHALL display tasks sorted by priority and deadline

### Requirement 3: AI 主动提醒与反馈

**User Story:** As a user, I want AI to proactively remind me and give honest feedback, so that I can improve my habits and stay on track.

#### Acceptance Criteria

1. WHEN the Reminder_Engine analyzes user data, THE Assistant SHALL identify patterns and anomalies in behavior
2. WHEN a task is overdue, THE Reminder_Engine SHALL generate a reminder with context about the delay
3. WHEN user behavior contradicts stated goals, THE Assistant SHALL provide objective feedback
4. WHEN generating feedback, THE Assistant SHALL use the configured feedback style (gentle/direct/strict)
5. WHILE in do-not-disturb mode, THE Reminder_Engine SHALL queue reminders instead of sending immediately
6. WHEN a user dismisses a reminder, THE Reminder_Engine SHALL learn from the dismissal to improve future timing
7. WHEN weekly patterns are detected, THE Assistant SHALL generate a weekly summary with insights

### Requirement 4: 截图与翻译

**User Story:** As a user, I want to translate text from screenshots or by hovering over text, so that I can understand foreign content quickly.

#### Acceptance Criteria

1. WHEN a user triggers screenshot mode, THE Translation_Service SHALL capture the selected screen area
2. WHEN a screenshot is captured, THE Translation_Service SHALL perform OCR to extract text
3. WHEN text is extracted, THE Translation_Service SHALL translate it using the configured AI model
4. WHEN a user hovers over text with the translation hotkey held, THE Translation_Service SHALL translate the hovered text
5. WHEN translation is complete, THE Translation_Service SHALL display the result in a non-intrusive popup
6. IF OCR fails to extract text, THEN THE Translation_Service SHALL show an error message and suggest retrying

### Requirement 5: 日报生成

**User Story:** As a user, I want to receive daily briefings with summaries and suggestions, so that I can plan my day effectively.

#### Acceptance Criteria

1. WHEN morning briefing time arrives, THE Daily_Report SHALL generate a summary of yesterday's activities
2. WHEN generating morning briefing, THE Daily_Report SHALL include today's scheduled tasks and suggestions
3. WHEN evening briefing time arrives, THE Daily_Report SHALL summarize today's accomplishments and pending items
4. WHEN a suggestion is presented, THE Assistant SHALL allow the user to accept, defer, or dismiss it
5. WHEN a user accepts a suggestion, THE Task_Service SHALL create a corresponding task
6. WHEN generating suggestions, THE Assistant SHALL consider user's historical patterns and stated goals

### Requirement 6: AI 对话

**User Story:** As a user, I want to have conversations with AI about my thoughts and get advice, so that I can think through problems and get support.

#### Acceptance Criteria

1. WHEN a user sends a message, THE Chat_Interface SHALL display the message and show a typing indicator
2. WHEN generating a response, THE Assistant SHALL consider the user's memory context from Memory_System
3. WHEN the response is ready, THE Chat_Interface SHALL display it with proper formatting
4. WHEN a user asks about past notes or tasks, THE Memory_System SHALL retrieve relevant context
5. WHEN a conversation contains actionable items, THE Assistant SHALL offer to create tasks or notes
6. WHEN a user requests decision support, THE Assistant SHALL provide balanced analysis with pros and cons

### Requirement 7: 文件管理与搜索

**User Story:** As a user, I want AI to help organize my messy files and quickly find important documents, so that I can access information efficiently.

#### Acceptance Criteria

1. WHEN a user adds a folder to watch, THE File_Manager SHALL index all documents in that folder
2. WHEN a new file is detected in watched folders, THE File_Manager SHALL perform OCR and extract content
3. WHEN content is extracted, THE Memory_System SHALL categorize and tag the document automatically
4. WHEN a user searches for a document, THE File_Manager SHALL return results based on content and metadata
5. WHEN displaying search results, THE File_Manager SHALL show document preview and relevance score
6. WHEN a user asks AI about document content, THE Memory_System SHALL retrieve relevant document context
7. IF a file format is unsupported, THEN THE File_Manager SHALL log the file and notify the user

### Requirement 8: 数据同步与存储

**User Story:** As a user, I want my data to sync across devices while staying private, so that I can access my information anywhere.

#### 架构说明

采用 **Local-First + Cloud Backup** 架构：
- 本地优先：SeekDB 作为本地数据库，保证离线可用和快速响应
- 云端备份：Supabase (PostgreSQL + pgvector) 作为云端存储，实现多端同步
- 用户已熟悉 Supabase，学习成本低

#### Acceptance Criteria

**本地存储：**
1. WHEN data is created or modified, THE Assistant SHALL first persist to local SeekDB
2. WHEN the app starts offline, THE Assistant SHALL load all data from local SeekDB
3. WHEN local storage is corrupted, THE Assistant SHALL restore from cloud backup

**云端同步：**
4. WHEN data is modified on one device, THE Assistant SHALL sync changes to Supabase cloud
5. WHEN syncing data, THE Assistant SHALL encrypt sensitive data before transmission
6. WHEN a sync conflict occurs, THE Assistant SHALL preserve both versions and prompt user to resolve
7. WHEN a new device is added, THE Assistant SHALL pull all data from cloud to local SeekDB

**离线支持：**
8. WHILE offline, THE Assistant SHALL queue changes and sync when connection is restored
9. WHEN connection is restored, THE Assistant SHALL sync queued changes in order
10. WHEN offline for extended period, THE Assistant SHALL warn about potential sync conflicts

**数据导出：**
11. WHEN a user exports data, THE Assistant SHALL generate a portable format (JSON/Markdown)
12. WHEN a user imports data, THE Assistant SHALL merge with existing data without duplicates

### Requirement 9: 用户偏好设置

**User Story:** As a user, I want to customize the assistant's behavior and appearance, so that it fits my personal workflow.

#### Acceptance Criteria

1. WHEN a user opens settings, THE Assistant SHALL display all configurable options organized by category
2. WHEN a user changes feedback style, THE Reminder_Engine SHALL apply the new style to future feedback
3. WHEN a user sets do-not-disturb hours, THE Reminder_Engine SHALL respect these hours for all notifications
4. WHEN a user configures AI model, THE Assistant SHALL use the specified model for all AI operations
5. WHEN a user changes language preference, THE Assistant SHALL update all UI text and AI responses
6. WHEN settings are changed, THE Assistant SHALL persist changes immediately and sync across devices

### Requirement 27: 轻量网页版

**User Story:** As a user, I want to access my notes and tasks from any browser, so that I can quickly check information when I don't have the app installed.

#### 架构说明

轻量网页版部署在 Vercel，提供基础功能访问：
- 前端：React (与客户端共享组件)
- 后端：Vercel Edge Functions
- AI：通过 Edge Functions 调用 Gemini API
- 数据：直接连接 Supabase

#### Acceptance Criteria

**基础功能：**
1. WHEN a user visits the web app, THE Web_App SHALL require authentication via Supabase Auth
2. WHEN authenticated, THE Web_App SHALL display the user's notes and tasks from Supabase
3. WHEN a user creates a note on web, THE Web_App SHALL save to Supabase and sync to clients
4. WHEN a user creates a task on web, THE Web_App SHALL save to Supabase and sync to clients

**AI 对话：**
5. WHEN a user sends a message on web, THE Web_App SHALL call Gemini API via Edge Function
6. WHEN generating responses, THE Web_App SHALL retrieve memory context from Supabase
7. WHEN a conversation contains actionable items, THE Web_App SHALL offer to create tasks or notes

**限制说明：**
8. THE Web_App SHALL NOT support activity monitoring (requires system access)
9. THE Web_App SHALL NOT support screenshot translation (requires system access)
10. THE Web_App SHALL NOT support file management (requires local file access)
11. THE Web_App SHALL NOT support voice recording (limited browser support)

**响应式设计：**
12. WHEN accessed from mobile browser, THE Web_App SHALL display a mobile-optimized layout
13. WHEN accessed from desktop browser, THE Web_App SHALL display a desktop layout

---

## B. 工作与职业 (Requirements 10-14, 19, 23-25)

### Requirement 10: 外部系统集成

**User Story:** As a user, I want the assistant to connect with my RiskControl system and other APIs, so that I can get a unified view of my investment status.

#### Acceptance Criteria

1. WHEN a user configures an external API endpoint, THE External_API SHALL validate the connection and store credentials securely
2. WHEN the RiskControl API is connected, THE Assistant SHALL fetch portfolio data and risk metrics periodically
3. WHEN investment data is retrieved, THE Memory_System SHALL incorporate it into the user's context
4. WHEN a user asks about investments, THE Assistant SHALL query the RiskControl API for real-time data
5. WHEN generating daily reports, THE Daily_Report SHALL include investment summary if RiskControl is connected
6. IF an API connection fails, THEN THE External_API SHALL retry with exponential backoff and notify the user

### Requirement 11: GitHub 项目监控

**User Story:** As a developer, I want the assistant to monitor my GitHub projects, so that I can stay informed about my development activities.

#### Acceptance Criteria

1. WHEN a user connects their GitHub account, THE GitHub_Monitor SHALL fetch the list of repositories
2. WHEN monitoring is enabled for a repository, THE GitHub_Monitor SHALL track commits, issues, and pull requests
3. WHEN new activity is detected, THE GitHub_Monitor SHALL create a summary and store in Memory_System
4. WHEN a user asks about project status, THE Assistant SHALL retrieve recent GitHub activity
5. WHEN generating weekly reports, THE Daily_Report SHALL include development activity summary
6. WHEN a repository has no activity for a configured period, THE Reminder_Engine SHALL remind the user

### Requirement 12: 多领域生活管理

**User Story:** As a user with multiple life domains, I want the assistant to understand and balance my different roles, so that I can manage my time effectively.

#### Acceptance Criteria

1. WHEN a user creates a note or task, THE Assistant SHALL suggest a life domain classification
2. WHEN viewing statistics, THE Assistant SHALL show time and effort distribution across domains
3. WHEN one domain is neglected, THE Reminder_Engine SHALL suggest rebalancing
4. WHEN generating suggestions, THE Assistant SHALL consider all life domains holistically
5. WHEN a user sets goals for a domain, THE Assistant SHALL track progress and provide feedback
6. WHEN family events are recorded, THE Reminder_Engine SHALL prioritize family-related reminders appropriately

### Requirement 13: 美术工作支持

**User Story:** As an art manager, I want the assistant to help with my professional work, so that I can be more effective in my role.

#### Acceptance Criteria

1. WHEN a user records work-related notes, THE Memory_System SHALL categorize them under the work domain
2. WHEN a user has meetings or deadlines, THE Task_Service SHALL integrate with calendar if available
3. WHEN generating work summaries, THE Daily_Report SHALL focus on professional achievements and pending items
4. WHEN a user asks for work advice, THE Assistant SHALL consider the art management context
5. WHEN work-life balance is off, THE Reminder_Engine SHALL suggest adjustments

### Requirement 14: 开发项目追踪

**User Story:** As a developer working on multiple projects (RiskControl, 3D AI system), I want the assistant to track my development progress, so that I can manage my side projects effectively.

#### Acceptance Criteria

1. WHEN a user mentions a project name, THE Memory_System SHALL associate the context with that project
2. WHEN tracking development time, THE Assistant SHALL log time spent on each project
3. WHEN a project has no progress for a week, THE Reminder_Engine SHALL ask about the project status
4. WHEN generating development reports, THE Daily_Report SHALL show progress across all projects
5. WHEN a user sets development goals, THE Task_Service SHALL create milestones and track completion
6. WHEN GitHub activity is detected for a project, THE GitHub_Monitor SHALL update the project status

### Requirement 19: 周报生成与汇报支持

**User Story:** As an employee with weekly reporting requirements, I want the assistant to help me generate impressive weekly reports, so that I can showcase my achievements effectively.

#### Acceptance Criteria

1. WHEN a user requests weekly report generation, THE Daily_Report SHALL compile the week's activities and achievements
2. WHEN generating weekly reports, THE Assistant SHALL highlight key accomplishments and quantifiable results
3. WHEN work activities are tracked, THE Memory_System SHALL categorize them by project and impact
4. WHEN a user adds notes about achievements, THE Assistant SHALL incorporate them into report drafts
5. WHEN generating reports, THE Assistant SHALL use professional language suitable for management review
6. WHEN the report is generated, THE Assistant SHALL allow editing and refinement before finalizing
7. WHEN weekly report time approaches, THE Reminder_Engine SHALL remind the user to review and prepare
8. WHEN generating reports, THE Assistant SHALL suggest ways to present work more impressively

### Requirement 23: 团队管理能力提升

**User Story:** As a manager of a small team (~10 people), I want the assistant to help me improve my team management and motivational skills, so that I can become a better leader.

#### Acceptance Criteria

**管理知识学习：**
1. WHEN a user reads management-related content, THE Memory_System SHALL extract and store key insights
2. WHEN a user asks about management techniques, THE Assistant SHALL provide relevant learned knowledge
3. WHEN generating learning reports, THE Daily_Report SHALL include management skill progress

**团队互动追踪：**
4. WHEN a user records team interactions (1:1s, meetings, feedback), THE Memory_System SHALL log and analyze patterns
5. WHEN a user hasn't had 1:1 with a team member for a configured period, THE Reminder_Engine SHALL suggest scheduling one
6. WHEN team member information is recorded, THE Assistant SHALL help remember personal details and preferences

**激励技巧提升：**
7. WHEN a user needs to give feedback, THE Assistant SHALL suggest constructive approaches
8. WHEN a user records team achievements, THE Assistant SHALL suggest recognition opportunities
9. WHEN team morale indicators are low, THE Assistant SHALL suggest motivational actions
10. WHEN a user asks how to motivate a specific team member, THE Assistant SHALL consider that person's recorded preferences

**管理反思：**
11. WHEN generating weekly reports, THE Daily_Report SHALL include team management reflection prompts
12. WHEN a user records management challenges, THE Assistant SHALL suggest relevant resources and approaches
13. WHEN patterns of management issues are detected, THE Assistant SHALL provide honest feedback and improvement suggestions

**持续改进：**
14. WHEN a user sets management improvement goals, THE Task_Service SHALL track progress
15. WHEN management books or courses are completed, THE Memory_System SHALL prompt for key takeaways
16. WHEN a user successfully applies a management technique, THE Assistant SHALL reinforce the learning

### Requirement 24: 语音笔记与会议记录

**User Story:** As a manager who attends important meetings and reports, I want to record voice notes and have them transcribed and organized, so that I never miss important information.

#### Acceptance Criteria

**语音录制：**
1. WHEN a user starts voice recording, THE Note_Service SHALL capture audio with timestamp
2. WHEN recording is stopped, THE Note_Service SHALL transcribe the audio using AI
3. WHEN transcription is complete, THE Memory_System SHALL extract key points and action items
4. WHEN a meeting is recorded, THE Assistant SHALL identify speakers if possible

**智能整理：**
5. WHEN transcription contains action items, THE Task_Service SHALL suggest creating tasks
6. WHEN transcription mentions deadlines, THE Task_Service SHALL extract and highlight them
7. WHEN transcription mentions people, THE Assistant SHALL link to relevant team member records
8. WHEN a user searches for past discussions, THE Memory_System SHALL search across all transcriptions

**汇报支持：**
9. WHEN a user is in a reporting meeting, THE Assistant SHALL provide quick access to relevant data
10. WHEN recording important reports, THE Note_Service SHALL tag them for easy retrieval
11. WHEN generating weekly reports, THE Daily_Report SHALL reference key meeting outcomes

### Requirement 25: 任务分配与团队协作

**User Story:** As a team manager, I want to assign tasks to team members and track their progress, so that I can manage team workload effectively.

#### Acceptance Criteria

**任务分配：**
1. WHEN a user creates a task, THE Task_Service SHALL allow assigning to a team member
2. WHEN a task is assigned, THE Task_Service SHALL record the assignee and assignment date
3. WHEN viewing tasks, THE Task_Service SHALL show tasks grouped by assignee
4. WHEN a team member's workload is high, THE Assistant SHALL warn before assigning more tasks

**进度追踪：**
5. WHEN an assigned task deadline approaches, THE Reminder_Engine SHALL remind the manager to follow up
6. WHEN a user marks a delegated task as complete, THE Task_Service SHALL record completion and update statistics
7. WHEN generating team reports, THE Daily_Report SHALL show task distribution and completion rates

**待办整理：**
8. WHEN a user has many pending tasks, THE Assistant SHALL suggest prioritization
9. WHEN tasks from meetings are extracted, THE Task_Service SHALL suggest appropriate assignees based on history
10. WHEN a user asks about team capacity, THE Assistant SHALL show current task distribution
11. WHEN tasks are overdue, THE Reminder_Engine SHALL escalate reminders appropriately

---

## C. 系统感知 (Requirement 15)

### Requirement 15: 电脑活动全面感知

**User Story:** As a user working on Mac and PC, I want the assistant to fully understand everything I do on my computer, so that it can truly become my second brain.

#### Acceptance Criteria

1. WHEN the activity monitor is enabled, THE Assistant SHALL track active application usage time
2. WHEN a user switches between applications, THE Assistant SHALL log the transition with timestamp
3. WHEN tracking activity, THE Assistant SHALL categorize applications by domain (development/design/communication/browsing)
4. WHEN a user works on a specific project, THE Assistant SHALL associate the activity with that project context
5. WHEN generating daily reports, THE Daily_Report SHALL include a summary of time spent on different activities
6. WHEN unusual patterns are detected (e.g., excessive social media), THE Reminder_Engine SHALL provide gentle feedback
7. WHEN a user types text, THE Activity_Monitor SHALL capture input content and store in Memory_System
8. WHEN clipboard content changes, THE Activity_Monitor SHALL capture and index the content
9. WHEN a user requests activity insights, THE Assistant SHALL show productivity trends and suggestions
10. WHEN capturing screen content, THE Activity_Monitor SHALL periodically take screenshots for context understanding
11. WHEN a user browses websites, THE Activity_Monitor SHALL log URLs and page titles
12. WHEN a user writes code, THE Activity_Monitor SHALL understand the coding context and project association

---

## D. 学习与成长 (Requirements 16, 18, 20)

### Requirement 16: AI 知识学习追踪

**User Story:** As a learner, I want the assistant to track my AI knowledge learning progress, so that I can systematically improve my skills.

#### Acceptance Criteria

1. WHEN a user reads AI-related articles or watches tutorials, THE Activity_Monitor SHALL detect and log the learning activity
2. WHEN learning content is captured, THE Memory_System SHALL extract key concepts and store them
3. WHEN a user asks about previously learned topics, THE Assistant SHALL retrieve relevant learning history
4. WHEN generating weekly reports, THE Daily_Report SHALL summarize learning progress and new knowledge acquired
5. WHEN a user sets learning goals, THE Task_Service SHALL track progress toward those goals
6. WHEN learning activity decreases, THE Reminder_Engine SHALL encourage continued learning

### Requirement 18: 投资学习追踪

**User Story:** As an investor, I want the assistant to track my investment learning activities, so that I can improve my investment knowledge systematically.

#### Acceptance Criteria

1. WHEN a user reads investment-related content, THE Activity_Monitor SHALL log the learning activity
2. WHEN investment concepts are learned, THE Memory_System SHALL store and connect them to existing knowledge
3. WHEN a user makes investment decisions, THE Assistant SHALL reference relevant learned knowledge
4. WHEN generating reports, THE Daily_Report SHALL include investment learning progress
5. WHEN combined with RiskControl data, THE Assistant SHALL provide insights connecting theory and practice

### Requirement 20: 沉浸式英语学习

**User Story:** As an English learner, I want the assistant to help me learn English naturally during daily work, so that I can improve without dedicated study time.

#### Acceptance Criteria

1. WHEN DejaVocab application is opened, THE Activity_Monitor SHALL log the learning session
2. WHEN a user hasn't opened DejaVocab for a configured period, THE Reminder_Engine SHALL send a gentle reminder
3. WHEN tracking English learning, THE Memory_System SHALL record vocabulary progress if accessible
4. WHEN generating daily reports, THE Daily_Report SHALL include English learning status
5. WHEN a user encounters English content during work, THE Assistant SHALL suggest adding new words to learn
6. WHEN translation feature is used frequently, THE Assistant SHALL identify commonly translated words for learning
7. WHEN learning streak is broken, THE Reminder_Engine SHALL encourage resuming without judgment
8. WHEN a user sets English learning goals, THE Task_Service SHALL track daily/weekly progress
9. WHEN displaying UI text, THE Assistant SHALL optionally show bilingual labels (中英对照) for passive learning
10. WHEN a user reads Chinese content, THE Assistant MAY suggest English equivalents for key terms
11. WHEN a user writes notes in Chinese, THE Assistant MAY offer to help express the same idea in English
12. WHEN browsing websites, THE Assistant MAY highlight and translate selected English words inline (like Toucan)
13. WHEN a user watches videos, THE Assistant MAY provide dual subtitles if available
14. WHEN a new English word is learned, THE Memory_System SHALL schedule spaced repetition reminders

---

## E. 健康与情绪 (Requirements 17, 21-22)

### Requirement 17: 娱乐与休闲追踪

**User Story:** As a user, I want the assistant to know about my entertainment activities, so that it can help me balance work and leisure.

#### Acceptance Criteria

1. WHEN a user watches movies or TV shows, THE Activity_Monitor SHALL log the content and duration
2. WHEN entertainment time exceeds configured limits, THE Reminder_Engine SHALL provide gentle feedback
3. WHEN generating daily reports, THE Daily_Report SHALL include entertainment summary
4. WHEN a user asks for movie recommendations, THE Assistant SHALL consider viewing history and preferences
5. WHEN work-life balance is off, THE Assistant SHALL suggest appropriate leisure activities

### Requirement 21: 健康数据与情绪管理

**User Story:** As an investor prone to FOMO and emotional decisions, I want the assistant to monitor my health data and emotional state, so that I can make better decisions and maintain well-being.

#### Acceptance Criteria

1. WHEN Apple Health integration is enabled, THE Assistant SHALL fetch health metrics (heart rate, sleep, activity)
2. WHEN health data indicates stress (elevated heart rate, poor sleep), THE Reminder_Engine SHALL suggest taking a break
3. WHEN a user logs emotional state, THE Memory_System SHALL record and track emotional patterns
4. WHEN emotional volatility is detected before investment decisions, THE Assistant SHALL provide calming reminders
5. WHEN generating daily reports, THE Daily_Report SHALL include health and emotional summary
6. WHEN a user is about to make investment decisions during detected stress, THE Assistant SHALL warn about emotional bias
7. WHEN FOMO patterns are detected (frequent checking, impulsive actions), THE Assistant SHALL provide objective perspective
8. WHEN sleep quality is poor, THE Reminder_Engine SHALL suggest postponing important decisions
9. WHEN a user asks for investment advice, THE Assistant SHALL consider current emotional state in the response
10. WHEN weekly patterns show correlation between emotions and decisions, THE Assistant SHALL highlight these insights

### Requirement 22: 全面情绪管理

**User Story:** As a user with multiple life pressures, I want the assistant to help me manage emotions across all life domains, so that I can maintain emotional balance and make better decisions.

#### Acceptance Criteria

**投资情绪控制（最重要）：**
1. WHEN a user checks portfolio frequently (more than configured threshold), THE Reminder_Engine SHALL suggest reducing frequency
2. WHEN market volatility is high, THE Assistant SHALL proactively remind about long-term strategy
3. WHEN a user expresses FOMO in notes or chat, THE Assistant SHALL provide balanced perspective
4. WHEN a user is about to trade, THE Assistant SHALL ask for the reasoning and check against stated principles
5. WHEN emotional trading patterns are detected, THE Assistant SHALL generate a reflection report
6. WHEN a user sets investment rules, THE Assistant SHALL remind about these rules before trades
7. WHEN a user violates their own investment principles, THE Assistant SHALL provide honest feedback

**工作情绪管理：**
8. WHEN work stress indicators are detected (long hours, rushed tasks), THE Reminder_Engine SHALL suggest breaks
9. WHEN a user expresses frustration about work in notes, THE Assistant SHALL offer perspective and support
10. WHEN deadline pressure is high, THE Assistant SHALL help prioritize and reduce overwhelm

**家庭情绪管理：**
11. WHEN family-related stress is detected, THE Assistant SHALL remind about work-life balance
12. WHEN a user hasn't recorded family time for a while, THE Reminder_Engine SHALL gently suggest quality time

**学习与成长情绪：**
13. WHEN a user feels stuck or frustrated with learning, THE Assistant SHALL encourage and suggest alternatives
14. WHEN imposter syndrome patterns are detected, THE Assistant SHALL provide reassurance and evidence of progress

**通用情绪支持：**
15. WHEN negative emotional patterns persist, THE Assistant SHALL suggest professional support resources
16. WHEN a user achieves goals, THE Assistant SHALL celebrate and reinforce positive emotions
17. WHEN generating reports, THE Daily_Report SHALL include emotional wellness summary across all domains

---

## F. 家庭生活 (Requirement 26)

### Requirement 26: 家庭关怀与亲情管理

**User Story:** As a family person with a 2-year-old daughter and aging parents, I want the assistant to help me care for my family members, so that I can be a better husband, father, and son.

#### Acceptance Criteria

**女儿成长记录：**
1. WHEN a user records moments about their daughter, THE Memory_System SHALL organize them chronologically
2. WHEN a milestone is recorded (first words, first steps, etc.), THE Assistant SHALL highlight and celebrate it
3. WHEN generating reports, THE Daily_Report SHALL include recent family moments
4. WHEN a user asks about daughter's development, THE Assistant SHALL retrieve relevant recorded memories
5. WHEN it's time for regular activities (bedtime stories, playtime), THE Reminder_Engine SHALL remind gently

**女儿性格养成：**
6. WHEN a user records observations about daughter's behavior or personality, THE Memory_System SHALL track patterns
7. WHEN positive character traits are observed, THE Assistant SHALL suggest reinforcement activities
8. WHEN challenging behaviors are recorded, THE Assistant SHALL suggest age-appropriate guidance approaches
9. WHEN a user asks for parenting advice, THE Assistant SHALL consider daughter's recorded personality traits
10. WHEN generating reports, THE Daily_Report MAY include character development observations and suggestions

**女儿英语启蒙：**
11. WHEN a user records English learning activities with daughter, THE Memory_System SHALL track progress
12. WHEN it's time for English learning activities, THE Reminder_Engine SHALL suggest age-appropriate content
13. WHEN a user asks for English learning resources for toddlers, THE Assistant SHALL recommend suitable materials
14. WHEN English learning sessions are recorded, THE Assistant SHALL track consistency and suggest improvements
15. WHEN daughter shows interest in English content, THE Assistant SHALL suggest follow-up activities

**父母关怀：**
16. WHEN a user records information about parents' health or needs, THE Memory_System SHALL track and organize it
17. WHEN a user hasn't contacted parents for a configured period, THE Reminder_Engine SHALL suggest calling or visiting
18. WHEN parents have medical appointments or important dates, THE Reminder_Engine SHALL remind in advance
19. WHEN a user asks about parents' recent status, THE Assistant SHALL retrieve relevant recorded information
20. WHEN health concerns about parents are recorded, THE Assistant SHALL suggest follow-up actions

**家庭时间平衡：**
21. WHEN work activities dominate and family time is lacking, THE Reminder_Engine SHALL suggest rebalancing
22. WHEN planning weekends, THE Assistant SHALL suggest family activities based on recorded preferences
23. WHEN family events are upcoming (birthdays, anniversaries), THE Reminder_Engine SHALL remind with gift/activity suggestions
24. WHEN a user records quality family time, THE Assistant SHALL reinforce the positive behavior

**妻子关系维护：**
25. WHEN a user records important dates with spouse, THE Reminder_Engine SHALL remind in advance
26. WHEN a user hasn't recorded couple time for a while, THE Assistant SHALL gently suggest date ideas
27. WHEN relationship stress is detected, THE Assistant SHALL suggest communication or quality time
