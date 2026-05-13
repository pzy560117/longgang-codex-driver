---
name: git-xianyu-analyzer
description: Automates cloning a git repository, removing git history, analyzing the project comprehensively, and generating a Xianyu sales post. Use when the user provides a git URL and wants to prepare a project for Xianyu listing or sharing.
---

# Git Project Analyzer for Xianyu

Automates the workflow of cloning, cleaning, analyzing a project, and generating a professional Xianyu sales post.

## Workflow

### 1. Clone Repository
- Execute `git clone <url>` in the current working directory
- Git will automatically create a directory based on the repository name
- Verify clone success by checking if the directory exists

### 2. Clean Git History
- Remove the `.git` directory to detach from remote tracking
- Windows: `Remove-Item -Recurse -Force <repo_name>\.git`
- Unix/Linux/Mac: `rm -rf <repo_name>/.git`

### 3. Clean Open Source Information and Modify Documentation

**重要：隐藏开源来源，使项目看起来像独立开发的商业项目**

#### 3.1 删除开源标识文件
- Delete `LICENSE` or `LICENSE.txt` file
- Delete `.github` directory (contains GitHub workflows, issue templates)
- Delete `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` if exists
- Delete `CHANGELOG.md` or `HISTORY.md` if contains git history references

#### 3.2 修改 README.md

**必须移除的内容：**
- ❌ MIT/Apache/GPL 等开源协议声明
- ❌ GitHub 仓库链接、Star History、Issue/PR 链接
- ❌ "开源" "Open Source" 等字样
- ❌ 贡献者列表和感谢信息 (Contributors section)
- ❌ GitHub Badges (stars, forks, issues)
- ❌ "Fork" "Star" "Contribute" 相关号召
- ❌ 社区讨论链接 (Discussions, Discord, Slack)

**保留的内容：**
- ✅ 项目名称和描述
- ✅ 核心功能介绍
- ✅ 技术栈说明
- ✅ 安装和使用文档
- ✅ 配置说明
- ✅ 截图和演示（如果有）

**修改建议：**
- 将 README.md 改为纯技术文档风格
- 添加 "内部项目" 或 "学习项目" 标识
- 如果有版权声明，改为 "版权所有 © [年份] 保留所有权利"

#### 3.3 清理其他文档
- 检查 `docs/` 目录，移除贡献指南、行为准则等开源社区文档
- 保留技术文档、API 文档、使用手册

### 4. Analyze Project Comprehensively

Perform a thorough analysis of the project by examining:

#### 4.1 Tech Stack Detection
- Check for language-specific files:
  - `package.json` → Node.js, inspect dependencies for React/Vue/Next.js/Express/etc.
  - `requirements.txt`, `pyproject.toml`, `Pipfile` → Python, check for Django/Flask/FastAPI
  - `pom.xml`, `build.gradle` → Java/Maven or Gradle
  - `Cargo.toml` → Rust
  - `go.mod` → Go
  - `composer.json` → PHP
  - `.csproj`, `*.sln` → .NET/C#
  - `Gemfile` → Ruby
- Identify frameworks and libraries from dependency files
- Detect databases: check for `docker-compose.yml`, SQL files, ORM configs

#### 4.2 Project Structure Analysis
- List key directories and their purposes
- Identify architecture patterns (MVC, microservices, monorepo, etc.)
- Note important config files (`.env.example`, `config/`, `docker-compose.yml`)

#### 4.3 Feature Extraction
- Read modified `README.md` for feature descriptions (after cleaning open source info)
- Look for screenshots in `docs/`, `screenshots/`, or embedded in README
- Check for API documentation or Swagger/OpenAPI specs
- Scan source code for major modules/features

#### 4.4 Project Metadata
- **注意：不要提及开源协议**，改为说明 "完整项目文件"
- Project scale: approximate lines of code, number of files
- Deployment info: Docker support, CI/CD configs

### 5. Generate Three Types of Content

**Preparation:**
- Create a directory named `xianyu_materials` inside the project root: `<repo_name>/xianyu_materials/`

#### 5.1 Download Project Images (提取项目演示图)

**Step 1: Run automated download script**

Use the provided helper script to automatically extract and download images from `README.md`.

**Command:**
```bash
python .agents/skills/git-xianyu-analyzer/scripts/download_images.py <project_path>
```

**Actions:**
- The script analyzes `README.md`.
- Filters out badges and icons.
- Downloads valid demo images to `xianyu_materials/project_images/`.

**Step 2: Copy local project images**

Many projects include demo images in the repository root or subdirectories. Use `find_by_name` to locate these images and copy them to `project_images/`.

**Actions:**
1. Search for image files: `find_by_name` with extensions `["png", "jpg", "jpeg", "gif", "webp"]` in project root (MaxDepth: 2)
2. Exclude already processed files:
   - Skip `xianyu_materials/` directory
   - Skip badges/icons (e.g., small files < 10KB)
   - Skip logo files if irrelevant to demo
3. Copy relevant images to `xianyu_materials/project_images/`
4. Use descriptive names like `demo_01.png`, `screenshot_dashboard.png`

**Example:**
```bash
# Find images
find . -maxdepth 2 -type f \( -name "*.png" -o -name "*.jpg" \) ! -path "./xianyu_materials/*"

# Copy to project_images
cp drama.png xianyu_materials/project_images/
cp screenshot.png xianyu_materials/project_images/demo_01.png
```

**Note**: Some projects only have video demos (`.mp4`, `.webm`). In this case:
- Document video links in the cleaning log
- Users can download videos separately if needed for咸鱼 listing
- Focus on generating AI介绍图 as the primary visual material


#### 5.2 Deep Source Code Cleaning (LLM 源码深度清理)

Use the Agent's capabilities to deeply scan and clean the codebase:

1.  **Search**: Use `grep_search` to find `github.com`, `gitee.com`, `gitlab`, and other Repo URLs.
2.  **Analyze & Clean**:
    -   Remove `git clone` commands, repository URLs, and author links.
    -   Replace them with generic placeholders like `https://example.com/project` or remove entirely.
    -   **Ignore** library imports (e.g. `import github`) unless they point to the specific project's repo.
3.  **Log**: Create a log file at `xianyu_materials/cleaning_log.md` listing every file modified and what was removed.

#### 5.3 Compliance & Credits (合规与版权声明)

To respect open source licenses (e.g., MIT requires preservation of copyright notice) while maintaining a "clean" product look:

1.  **Generate NOTICE.txt**: Create a `NOTICE.txt` file in the project root.
    -   Content: "This software is based on open source components. Copyright (c) [Year] [Original Author]. Licensed under [License Name]."
    -   Keep this file to legally comply with permissive licenses like MIT/Apache.
2.  **Disclaimer in Docs**: Add a small section in `docs/` or `README.md` (if kept) stating: "Core engine based on open source technology, optimized for enterprise/commercial use."

#### 5.4 Pure Text Post (咸鱼发布用纯文本)

Generate a concise, pure text version suitable for direct copy-paste to Xianyu:

```
【项目名称】[项目名]

【技术栈】[主要技术，用空格分隔，如：Vue3 ElementPlus SpringBoot MySQL]

【项目简介】
[2-3 句话概括项目功能和特点]

【核心功能】
✅ [功能1]
✅ [功能2]  
✅ [功能3]

【适合场景】毕设 / 二开 / 学习

【交付】完整源码 + 数据库 + 文档

💰 质量保证，发货秒到！
```

**⚠️ 咸鱼敏感词规避规则（Critical！）:**

**严格禁止的词汇：**
- ❌ **源码/代码** → 改用：**项目文件/程序/系统**
- ❌ **毕设/毕业设计/课设** → 改用：**学习项目/练手项目/参考案例**
- ❌ **代写/定制开发** → 不要提及任何代做服务
- ❌ **破解/激活码/授权码** → 完全避免
- ❌ **虚拟商品/电子资料** → 改用：**技术资料/学习资料**
- ❌ **秒到/包赔/保证/担保** → 改用：**及时发货/质量优质**
- ❌ **加微信/QQ/私聊** → 不要留任何联系方式
- ❌ **Git/GitHub/Gitee** → 改用：**代码仓库/项目仓库**（如需提及）

**推荐用词替换表：**
```
源码 → 项目文件 / 完整项目 / 程序包
代码 → 程序 / 文件
毕设 → 学员作品 / 学习项目
课设 → 练习项目 / 实战案例
开发 → 搭建 / 编写
数据库 → DB / 存储方案
文档 → 说明 / 指南
部署 → 运行 / 启动
API → 接口
Admin → 管理端
```

**文案撰写要点：**
1. **模糊化技术性描述** - 不要过于详细的技术实现
2. **强调学习属性** - "适合新手学习"、"技术参考"
3. **避免商业化用词** - 不提"商用"、"企业级"
4. **使用正向词汇** - "实战项目"、"完整案例"、"功能齐全"
5. **不承诺服务** - 不说"包上线"、"免费维护"、"技术支持"

**标题建议格式：**
```
✅ [技术栈] 实战项目 全套资料 学习专用
✅ [项目类型] 完整程序 功能齐全
✅ [前端框架]+[后端框架] 全栈项目 参考案例
❌ Vue+SpringBoot源码 毕设代做 包调试
❌ XXX管理系统 完整源码+数据库
```

**Save the text:**
- Save the generated text to a file named `xianyu_materials/[项目名]_文案.txt` inside the project.

**Requirements:**
- Keep it concise (under 200 characters if possible)
- 严格避免上述敏感词
- Use euphemisms for technical terms
- Focus on "learning" and "reference" angle

#### 5.3 Detailed Introduction Image (详细介绍图片)

Use the `generate_image` tool to create a professional project introduction image with:

**Content to include:**
- Project name (large, prominent)
- Tech stack with icons/badges style
- Feature list (3-5 key features)
- Architecture diagram or feature highlights
- Project stats (Complete Deliverable, Enterprise Arch)
- "学习专用/二次开发/商业架构" tags
- Visual elements: use modern gradient backgrounds, clean typography
- **CRITICAL:** Do NOT include text like "Open Source", "MIT", "GitHub".

**Design guidelines:**
- Size: 1200x1600px (vertical, suitable for Xianyu)
- Use professional color scheme (tech blues, purples, or project-relevant colors)
- Clear hierarchy: title > tech stack > features > details
- Include visual separators between sections
- Use icons or badges for tech stack
- Modern, clean aesthetic

**Prompt template:**
```
A professional project introduction card for [项目名称], featuring:
- Large bold title at top
- Tech stack badges showing [列出技术栈]
- Feature list with [3-5个核心功能]
- Modern gradient background in [颜色主题]
- Clean typography, tech industry style
- **NO "Open Source" or "MIT" text**
- Vertical layout 1200x1600px
- Professional and attractive design
```

#### 5.4 Project Cover Image (项目封面图)

Generate TWO outputs:

**A. AI Prompt for Cover Image Generation:**

Create a detailed prompt based on project type and tech stack:

```
Prompt for [项目名称]:

主题：[根据项目类型，如：电商平台/管理系统/社交应用/数据分析工具等]

视觉元素：
- [场景描述，如：现代化的电商网站界面/专业的后台管理dashboard]
- [技术感体现，如：代码片段/数据可视化图表/3D立体界面]
- [色彩方案，如：科技蓝/商务紫/活力橙，根据项目定位]

风格：
- Modern tech illustration
- [具体风格，如：Isometric 3D/Flat design/Glassmorphism]
- Clean and professional
- [项目特定元素]

文字：无文字（或仅项目名称）

构图：16:9 横向，适合封面展示
```

**B. Directly Generate Cover Image:**

Use `generate_image` tool with the created prompt to generate the cover image.

**Image naming:**
- Cover image: `xianyu_materials/[项目名]_封面.png`

**C. Save Images:**
- Save the generated images to the `xianyu_materials/` directory created in step 5.

### 6. Final Output

Provide the user with:

1. **Pure text post content** - Inside `xianyu_materials/[项目名]_文案.txt`
3. **Project images** - Original demo images in `project_images/`
4. **Path to generated images** - Inside `xianyu_materials` folder
5. **AI prompt** - For reference or regeneration
6. **Project directory path** - Where everything is saved

Display a summary:
```
✅ 项目已准备完成！

📁 项目位置: [path]

📄 咸鱼文案（纯文本）:
[纯文本内容]

🖼️ 生成的图片 (位于 xianyu_materials 目录):
- 详细介绍图: [path]
- 项目封面图: [path]

🎨 封面生成提示词:
[AI prompt]

需要调整内容或重新生成图片吗？
```

## Notes

- Always verify the clone was successful before proceeding
- Handle encoding issues when reading text files (try UTF-8, fallback to other encodings)
- If README is very long, focus on the first few sections for feature extraction
- Be honest about project state - don't oversell if documentation is poor
