# 项目结构与工程边界

## 1. 规划目录

下列是实施目录规划；本阶段实际交付仅 `docs/`。前端只有同站 `apps/web`，包含学生功能与 `/admin` 管理workspace；一次构建产出 `index.html`、`admin.html` 两个document入口。后端仍按普通API、admin-api、command-runner、普通worker与平台AI分权限部署。工作区使用pnpm workspace，版本锁定，Node/CI/容器采用一致的受支持版本。

```text
SoClear/
├─ apps/
│  ├─ web/                         # 统一站点，React + TypeScript + Vite
│  │  ├─ index.html               # 学生document；CSP允许registry供应商
│  │  ├─ admin.html               # /admin鉴权document；connect-src self
│  │  └─ src/
│  │     ├─ app/                   # 学生document路由、布局、启动
│  │     ├─ admin/
│  │     │  ├─ app/               # 管理document、升权、退出与内存清理
│  │     │  ├─ navigation/        # 后端当前capability驱动导航/面板
│  │     │  ├─ features/          # 内容/数据/身份/AI/安全/运维所有管理面板
│  │     │  └─ commands/          # intent、确认/必要审批、任务与审计DTO
│  │     ├─ pages/                 # 页面级数据组合与状态
│  │     ├─ features/
│  │     │  ├─ teachers/           # api/queries/adapters/components
│  │     │  ├─ catalog/           # 课程、学院、学期
│  │     │  ├─ timetable/         # 开课与冲突条件
│  │     │  ├─ reviews/           # 提交、撤回、举报与申诉
│  │     │  ├─ account/           # 独立平台会话/恢复、匿名grant状态，无学校原文
│  │     │  └─ student-ai/
│  │     │     ├─ provider-session.ts # 当前页内存key、取消与引用清理
│  │     │     ├─ orchestrator.ts  # 本地DSL→本站公开证据→本地模型解释
│  │     │     ├─ tools-api.ts     # 仅search/evidence/validate，无凭据字段
│  │     │     ├─ output-policy.ts # ID/引用/数值校验及安全渲染
│  │     │     └─ components/      # 供应商、key、模型名与外发确认
│  │     └─ shared/                # 本站HTTP、UI、可访问性、受控错误
│  ├─ api/
│  │  └─ src/
│  │     ├─ bootstrap/            # ordinary/admin-api独立模式与凭据
│  │     ├─ gateway/              # 会话、CSRF、校验、限流、trace
│  │     ├─ modules/
│  │     │  ├─ cache-management/  # 后端缓存策略/版本/失效；每日快照写Supabase
│  │     │  ├─ reviews/           # routes/service/policy/repository/schemas/public/tests
│  │     │  ├─ student-query/     # 受控只读DSL与公开证据API
│  │     │  ├─ teacher-summaries/ # 当前平台总结的主库gate与DTO
│  │     │  └─ administration/   # admin路由/能力/intent/任务；普通模式不挂载
│  │     ├─ workflows/            # 跨域编排与事务协调
│  │     └─ infrastructure/       # DB、Redis、Auth、日志，不含模型密钥
│  ├─ student-verifier/           # 独立运行身份；不复用普通API日志/trace
│  │  └─ src/
│  │     ├─ proof-adapters/       # 可信学校proof，仅内存；不连接平台Auth身份
│  │     ├─ canonical-identity/   # 固定namespace/稳定subject，无原文存储
│  │     ├─ dedup/                # KMS全历史HMAC候选、keyring generation
│  │     └─ claim/                # 专用原子tag+grant+challenge port，非公开RPC
│  ├─ worker/
│  │  └─ src/                     # projector/importer/cache-sync分模式；无模型调用
│  ├─ command-runner/
│  │  └─ src/
│  │     ├─ security/             # 组权限/原grant处置/平台行为case，无校园身份揭示
│  │     ├─ ops/                  # 备份/恢复/发布等固定工作流，非通用shell
│  │     └─ secret-write/         # 专用写入密管，不持原值通用读取权
│  └─ ai-worker/
│     └─ src/
│        ├─ orchestrator/         # 平台任务、预算、受限内部port、结算
│        ├─ data-bridge/          # 指定修订脱敏/公开总结证据，独立reader进程
│        ├─ executor/             # 平台供应商调用，无DB/Redis/学生会话凭据
│        └─ result-policy/        # 分析schema、完整依赖、受控结果发布
├─ packages/
│  ├─ contracts/                  # 本站DTO、路径/错误码，零外部运行时依赖
│  ├─ ai-contracts/               # 受限DSL/证据/平台分析协议；纯类型常量，无key
│  ├─ ai-provider-adapters/
│  │  ├─ browser/                 # 学生浏览器直连，独立browser export
│  │  │  └─ registry.ts          # 精确HTTPS endpoint/协议/CORS能力/CSP来源
│  │  └─ server/                  # 仅平台executor导入，独立server export
│  ├─ backend-core/               # API/worker/AI共用后端用例及port，浏览器禁止引入
│  ├─ backend-adapters/           # SQL/Auth/Redis、supabase-cache-snapshot，仅服务端
│  ├─ ui/                         # 展示组件，可选；不持有凭据与授权
│  └─ tooling/                    # TS、lint、依赖图/CSP/秘密扫描配置
├─ supabase/
│  ├─ config.toml                 # 本地配置，不含生产秘密
│  ├─ migrations/                 # 唯一可发布的版本化SQL
│  ├─ tests/                      # grants/RLS/函数/约束/事务/AI数据隔离
│  └─ seed.sql                    # 纯合成数据
├─ ingestion/                     # 导入formats/transforms/无个人信息fixtures
├─ tests/
│  ├─ contracts/                 # OpenAPI/DTO/schema、DSL与证据票据一致性
│  ├─ e2e/                       # 同站学生/管理、全部管理面板、BYOK网络链路
│  ├─ security/                  # 双document/CSP/升权/撤销/任务重验、key/越权
│  └─ load/                      # 检索与平台AI分别压测，故障和冷启动
├─ infra/                        # 同域admin分流/document gate、独立进程/CSP
├─ scripts/                      # 边界检查、迁移前检、合成数据、文档校验
├─ docs/
├─ .github/workflows/            # 若采用GitHub，承载CI；否则映射所选平台
├─ .env.example                  # 变量名和占位符，无真实key
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
└─ package.json
```

后端规则只保留一个来源。API、普通 worker 与平台 AI 共用用例时迁入 `backend-core`，应用目录只装配自己的能力，不复制评分、撤稿或授权规则。平台 `orchestrator/data-bridge/executor` 是同产物的独立运行模式和进程，分别注入作业预算、脱敏读取、供应商调用所需的最小凭据；不能在一个进程合并所有模式。

不创建 `apps/admin` 或第二管理域名。`apps/web/src/admin`与学生入口共享必要UI和协议，管理document不导入BYOK adapter/供应商运行代码。入口对 `/admin`、`/admin.html`和嵌套路由执行身份/当前admin:enter gate；未登录走站点登录，非管理员403，已是管理员但未升权只给严格CSP的最小MFA/再认证页，成功才加载workspace。不能要求已有升权Cookie才能看到升权页。

积分、签到奖励与消费扣款已取消，不创建 points 域、积分表、奖励 RPC、扣款路由、定时任务或可恢复旧行为的开关。历史参考文件不作为当前工程依赖。

## 2. 依赖规则

允许的主要方向：

- `web`学生入口可导入contracts/ai-contracts/ui/ai-provider-adapters/browser；同一web的admin入口只导入管理DTO/UI与本站HTTP，不加载BYOK运行模块。
- `api/worker/ai-worker/command-runner → contracts/ai-contracts/backend-core`；每个运行模式只装配自己被授予的port与适配器。
- `student-verifier → contracts/backend-core`中获准的challenge/claim port；独立进程、DB执行身份与KMS使用权，不通过共享装配注入普通API、admin、worker或AI。学校/KMS网络校验在DB事务外，DB内只复验并原子领取。
- 只有平台 executor 可导入 `ai-provider-adapters/server`；只有 data bridge 持分析 reader 凭据；只有 orchestrator 持平台作业/预算凭据。
- `backend-core → contracts/ai-contracts` 与平台无关类型；跨域只用 `public.ts` 导出的显式 port。

禁止的方向：前端import API/worker/command-runner/ai-worker/backend-*/Supabase/ingestion；学生browser adapter引server adapter或BFF实现；普通API/worker引模型server adapter或管理执行器；平台AI引学生key管理代码。管理浏览器不引provider管理SDK、数据库SDK或运维执行库。contracts/ai-contracts不含框架、数据库/provider SDK、环境读取或数据库行类型。

`ai-provider-adapters` 没有同时 re-export browser/server 的通用根入口。browser/server 使用独立 export、构建清单与依赖门禁；前端产物不得包含平台 key、服务端 provider 配置、Node/SQL 客户端。browser 代码接收 key 的内存参数仅属于本地适配器，不得进入本站 API DTO、共享 HTTP client、队列或错误对象。

门禁检查 workspace、TS path alias、相对路径、动态 import 和实际产物图；只扫描 `server/` 字符串不够。私有平台分析 port 不能被 student-query 路由注册，公共证据 port 也不接受调用者指定私有表、状态或任意 endpoint。

普通API不可SET ROLE到管理执行角色；admin-api本身无owner/service_role、任意SQL/shell、全能云凭据或秘密原值读取接口。security、ops、secret-write runner分进程/网络/账号，仅消费自身类型的intent和任务，不能通过通用job payload选择任意方法、endpoint或运行角色。

数据库缓存策略统一在后端cache-management用例/port；API/worker/ops runner只复用同一来源。`supabase-cache-snapshot` adapter将后端运行缓存的获准固定版本每日分批写Supabase PostgreSQL的cache_persistence表，使用独立低权限SQL身份；schema/任务/连接秘密仅服务端，不引入另一缓存服务商SDK。前端/模型不能决定TTL、任意目标/表名或清理范围。会话/安全计数/费用/查重仍各自处理，不被缓存同步覆盖，协议见[16](16-backend-cache-and-daily-sync.md)。

## 3. 学生浏览器 AI 与前端约定

学生AI页面按[12](12-student-byok-ai.md)使用当前页内存key。禁止写localStorage/sessionStorage/IndexedDB/URL/Cookie/Service Worker/query cache/开发工具快照/日志/埋点/崩溃报告，不把学生key传本站任何fetch。离页、退出、换key或进入管理document前abort供应商请求、清key及未交付解释；不承诺JavaScript物理擦除内存。平台秘密替换使用另外的受限管理命令，不得借此接收学生key。

registry 维护精确 HTTPS endpoint、固定协议、可接受模型名语法及经测试的浏览器 CORS 能力，并与部署 CSP `connect-src` 同版本发布。模型名不能充当host、自由path或header；仅当协议要求时，按registry固定模板把已校验且正确转义的模型名填入指定path段，不能改变目标源或协议。供应商请求不携本站 Cookie、CSRF、Supabase token 或站内身份；禁止跟随未批准重定向泄露 key。CORS 不支持就禁用该供应商或换选项，绝不增加服务端 relay、`no-cors` 或通用代理回退。

学生只读工具使用本站统一 HTTP client，输入仅有 DSL、公开 ID、版本、签名 evidenceReceipt 及 validate 明确允许的引用/结构化数值，未知字段默认拒绝，特别禁止 providerKey/apiKey 等凭据。解释正文和完整模型回答只留在当前页，不上传本站或持久保存；validate 的有界引用/数值比对不等于上传整份回答。安全渲染与引用校验失败时只显示确定性候选，不能把任意 HTML/链接或模型指令当应用操作。

其他前端约定：

- 页面容器组合数据，展示组件只接收 props；共用响应式路由，不复制移动/桌面业务规则。
- 数据库查询缓存统一由后端生成、命名、刷新、失效和同步；前端只通过本站API取DTO，保留当前页面所需的短期展示状态和请求去重，不维护数据库副本、持久化查询结果或直连缓存服务商。换账号/退出清本人状态，评价正文、学生AI证据/回答、平台总结不进持久浏览器缓存。
- 本站普通 GET 有限重试；写入重试必须带原幂等键；401 不循环，429 遵循 Retry-After。学生供应商调用不透明重试，避免重复计费。
- 密码、身份令牌、学生证明、评价草稿不存 localStorage；临时草稿默认内存，持久化另做隐私评审。
- 学生 AI 页面不装载无关第三方脚本；CSP 与 key 仅内存不能替代 XSS、依赖与浏览器网络测试。

管理workspace具有独立document bootstrap与严格CSP `connect-src 'self'`，管理导航必须顶层完整重载，不能用SPA局部切换声称已收紧旧document的CSP。学生与管理Cookie均host-only、Path=/，同源共享XSS风险；不把Cookie名称、chunk拆分或隐藏JS资源当作数据授权。退出/降权清管理内存/升权态，以document导航回学生入口，管理HTML/数据均no-store。pagehide清敏感视图和BYOK引用；pageshow含历史/BFCache恢复先复验当前会话/能力，不能直接展示旧管理DTO或恢复旧key。

管理导航只对当前system_admin/content_admin展示，面板与动作按后端组内capability摘要控制；每次提交重验当前DB组/capability:scope/对象权限、aal2/最近认证、roleVersion/sessionEpoch、CSRF和版本。固定另三组为verified_student/user/guest，管理员组互斥、无数字继承；管理员学生行为仍另验独立active grant。content_admin不能取得系统能力，system_admin也非DB owner；矩阵见[14](14-admin-workspace-and-security.md)。

站内必须包含内容治理、教学资料/同名映射/导入、匿名grant处置/封禁、AI分析总结、registry/模型/预算、组权限/审计/平台行为核查、功能/限流/缓存/队列、备份恢复发布等管理面板。无学校身份揭示、材料或tag浏览功能。面板建立类型化intent、展示差异/风险、跟踪执行与审计；仅具体高影响操作要求站内额外确认/审批，不普遍增加审批，也不把日常功能留给CLI。初始两名system_admin引导和灾难break-glass仅为受控审计例外。

## 4. 后端、平台 AI 与配置

所有本站路由声明输入/输出 schema、权限、请求大小、超时、缓存类别和限流策略。学生接口仅为 `/api/v1/ai/student/search`、`/api/v1/ai/student/evidence`、`/api/v1/ai/student/evidence/validate` 的明确只读协议；它们不生成学生 AI job、不为学生调用模型、不保存供应商 key/费用账、不提供服务端 SSE。响应按白名单序列化，不直接返回数据库整行，validation 错误也不能回显原始输入秘密。

平台 AI 单独声明 job kind、target revision/scope epoch、输入字段、输出 schema、调用上限、队列、预算、去重与撤稿策略，详见 [13](13-platform-ai-analysis.md)。普通 worker 不装配模型 SDK；平台 executor 不接收客户端任意 endpoint 或学生 key。作业消息只含 ID、版本和最小元数据，脱敏正文只由 data bridge 通过有界短期 payload 交付，不把原始评价全文写入队列/遥测。

管理API只在受限admin-api模式挂载 `/api/v1/admin/**`；同域入口精确分流，不能让普通模式catch-all接管。管理任务使用operation intent和command job协议：提交绑定actor/capability/scope/摘要/版本；执行前及不可逆阶段前重验当前授权和必要批准，撤销后未执行任务停止。任务重试只能重放固定命令，不能重放任意前端代码或SQL。

平台秘密页面只显示keyRef/指纹/版本状态，替换值只在当前输入内存，经专用权限+升权+CSRF的秘密写入端点直接交密管。此route关闭body日志/遥测/缓存，值不进入DB、intent参数、任务payload、错误或回显；异步记录仅保存已创建的secret reference与版本。前端没有provider SDK或读取原值按钮，写入失败需要明确重新输入，不能从队列恢复明文。

配置启动时校验。统一 `SITE_ORIGIN`，固定 `/admin` document与 `/api/v1/admin`路由；按document分别配置CSP，不再以第二管理origin配置身份边界。普通API保留按角色DATABASE、Auth公开客户端配置、两类Redis、会话/证据签名key reference和遥测；admin-api另有升权会话/入口gate配置，无高权限万能key。`COMMAND_RUNNER_MODE`限定security/ops/secret-write及对应port/凭据；Auth管理能力只进受限security runner。平台AI单独维护模式、角色/port、供应商、预算与队列；运行时平台供应商key仅executor可读，secret-write只获创建/替换指定引用权。

前端可发布 registry、允许模型选项、公开 endpoint/CSP 配置和本站 API 路径；**学生供应商 key 是运行时页面输入，不是 VITE_*、构建环境或后台设置**。所有模板使用占位符，不复制旧仓库 key。平台摘要生成与评价辅助分析不是学生付费功能，不创建积分或学生费用扣减配置。

学生认证配置与实现遵循[15](15-anonymous-student-verification.md)：可信issuer/规范namespace与subject、KMS keyring/恢复水位和零原文日志独立校验；认证流的学校账号、姓名/邮箱、subject/token、材料及密文不进Auth身份、数据库、队列、备份或任何采样。查重集合仅keyVersion+tag，无平台账号/时间关联列；grant无tag，无自动到期/续证。普通API只创建无校园数据challenge和读取本人最小grant状态，不接受客户端tag或直接授予verified_student。

## 5. 质量门禁

P0 建立 format、lint、typecheck、unit/db/contract/e2e、边界/秘密扫描、docs 与 build 脚本；当前仅是规划，不声称已有可执行命令。

关键证据包括：浏览器填写合成 canary key 后，只有批准供应商请求携带它，本站请求/日志/存储/缓存/URL/Service Worker 中均无该值；CORS 失败不触发任何 relay；恶意模型字段不能改变 endpoint 或取私有证据；未知 key 字段被本站 schema 拒绝且不回显；学生工具永远不能读 pending/作者映射/平台私有分析。

平台验证真实数据库角色、三进程凭据/网络隔离、结果 schema、绝对评分贡献不受 AI 改动、人工审核权限、完整证据清单、发布/每读 gate、新增或撤回来源即时使总结失效、未知供应商用量与槽位保守隔离。UI/容量与低风险文案变更按实际风险选择测试，不为实现细节重复造断言。

管理验收覆盖：同站登录/MFA bootstrap无循环；直接admin HTML别名/接口访问、每能力组/学校/对象越权、前端isAdmin伪造均被后端拒绝；document重载和CSP实测、BYOK清理、同源XSS防线；角色即时撤销、排队job执行前/关键阶段重验、intent重放/版本冲突与高影响站内审批；全部管理面板可操作对应受控能力；秘密替换canary只到密管写入链路，不进DB/队列/日志且不能取回原值。细节遵循[14](14-admin-workspace-and-security.md)。

身份验收另覆盖五组分类/管理组互斥与组内权限上限、管理员无grant时不能调用学生API、同身份/同账号并发最多首次领取、响应丢失恢复、历史key轮换与不完整恢复时关闭新认证。合成校园身份canary须遍历Auth.identities、代理/APM/错误、DB、对象/队列和备份验证零原文落盘；删号/撤销不清tag，恢复只回原平台账号。
