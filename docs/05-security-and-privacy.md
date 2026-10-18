# 安全、隐私与信任边界

状态：安全设计基线v0.6，2026-10-18，尚未实施。管理工作区见[14](14-admin-workspace-and-security.md)，学生零原文认证见[15](15-anonymous-student-verification.md)，后端缓存每日写Supabase见[16](16-backend-cache-and-daily-sync.md)。后端身份按能力隔离。

## 1. 保护对象与威胁模型

保护学生身份与评价内容的关联、未发布评价、管理员权限、教学资料完整性、模型/基础设施密钥和费用额度。假设攻击者可以注册账号、重放请求、直接调用 Supabase、控制评价文本、上传恶意文件、伪造代理头并并发请求。

| 威胁 | 必须具备的控制 | 必测失败路径 |
| --- | --- | --- |
| 越权读取他人评价/资格 | 对象授权、RLS、列白名单、私有作者映射；认证不存材料 | 替换 review_id/job_id/grant_id，读他人待审数据或校园信息 |
| 绕过网关直读 Supabase | 关闭不用的 Data API、未暴露 schema、撤销 grants/default privileges | anon/学生 token 直 REST/RPC/GraphQL/Realtime/Storage |
| 改作者/状态/角色/分数统计 | 拒绝额外字段、服务端身份、受控命令函数 | 提交 author_id/status/role/publication_generation |
| JWT/会话伪造与角色滞后 | 可信验证库、issuer/audience/alg/exp 校验、当前角色检查 | 错项目 token、过期 token、停用后旧会话 |
| CSRF/会话固定 | HttpOnly Cookie、CSRF、Origin、会话轮换 | 跨站表单、同站子域、伪造回调 state |
| SQL 注入/查询放大 | 参数化、排序白名单、长度/页数/时间上限 | 关键词/游标/过滤器注入、任意 count、超长 IN |
| XSS/评价带指令 | 纯文本渲染、安全 Markdown、链接协议限制 | HTML/SVG/脚本 URL、模型输出隐藏链接 |
| 缓存泄漏或污染 | public 路由隔离、规范 key、正文授权栅栏 | A 用户内容经 CDN/Redis 返回给 B，撤稿仍可取正文 |
| 刷评/撞库/短信邮箱轰炸 | 学生资格、分层限流、唯一约束、风险挑战 | 同用户多 IP、校园 NAT、注册/OTP 扫描 |
| 学生Key泄漏/恶意模型调用 | 浏览器内存、精确目标、CSP、独立transport、仅公开证据 | Key流入本站/遥测/存储，模型诱导改endpoint或取私有资料 |
| 平台模型注入/失控费用/置信度误伤 | 受控data bridge、指定修订、独立预算/并发、人工审核 | 评论注入泄密指令、任务重放、低分被直接标假、旧总结复活 |
| 管理员误操作/滥权 | 动作 capability、短时升权、版本/摘要、审计、高影响操作预览 | 审核员查作者、给自己授权、审核自己的评价、撤权后执行旧任务 |
| 同站管理页被学生页脚本滥用 | 文档级 CSP、移除 BYOK、无第三方脚本、XSS 防护、管理会话和权限复验 | SPA 切页沿用宽 CSP、同源 XSS 携带管理 Cookie 请求、缓存后台 HTML |
| 运维/安全控制被变成通用执行器 | 固定命令注册表、独立 runner、类型化参数、资源 scope、关键操作确认 | 任意 shell/SQL、任意备份/制品 URL、把system_admin当数据库owner |
| 学号枚举/重复认证/恢复重置额度 | 可信proof、隔离HMAC key、全历史版本查重、单事务唯一tag+grant、零原文日志 | 自填学号/MD5、并发多账号、换issuer/规范/Key、删号或回退备份重领 |
| 导入破坏/供应链问题 | 限制格式、staging、dry-run、锁版本、秘密扫描 | ZIP 炸弹、CSV 公式、路径穿越、错误教师合并 |

边界内也存在风险：完整后端失陷可能伪造该进程可用的用户上下文；已下载内容无法从用户设备收回。权限隔离、撤稿与审计降低影响面，不承诺绝对匿名或删除所有副本。

## 2. 身份、会话与授权

### 2.1 应用身份与短时管理升权

应用身份使用 `__Host-sc_session`，随机至少 256 bit，设置 `Secure; HttpOnly; Path=/; SameSite=Lax`，无 `Domain`。同站另用随机不透明的 `__Host-sc_admin` 表示短时升权，设置 `Secure; HttpOnly; Path=/; SameSite=Strict`，无 `Domain`；不能把应用会话或 `isAdmin` 提示直接当作管理授权。原始 Cookie 不写日志，服务端保存 HMAC 索引，Supabase Auth refresh token 加密保存。学生自己填写的模型 Key 不是这两类会话，只留学生页面内存，绝不进入会话存储。

管理升权绑定 `userId`、应用 `appSessionId`、服务端核实的 `aal2`、`authTime`、当前 `roleVersion`、用户/应用 `sessionEpoch`、学校范围与过期/撤销状态；元数据对应 `private.admin_sessions_metadata`。客户端提供的 AAL、角色、认证时间和学校范围不能覆盖这些值。每次管理请求重新验证应用会话与管理会话的绑定，并从数据库取得当前 capability、学校 scope、账号状态和对象权限；不把签名令牌里或页面缓存的角色当作当前事实。

待 P0 固定的默认值：应用会话空闲 12 小时、绝对 7 天；管理升权空闲 15 分钟、绝对 60 分钟；敏感 intent 执行前要求最近 5 分钟内完成强认证。登录、升权、凭据重置时轮换相关会话，应用会话变更后旧管理绑定失效。退出管理撤销当前管理会话但可保留学生应用会话；退出应用、所有设备退出、安全冻结或凭据重置按策略同时撤销关联管理会话并提升 epoch。会话/当前授权存储不可用时拒绝管理能力，不降级为普通应用身份执行。

两个 Cookie 同 host 且 `Path=/`，浏览器也会在非管理路径携带管理 Cookie。可信入口向普通 API/静态上游转发前剥离 `__Host-sc_admin`，保留普通私有路由需要的应用 Cookie；公共缓存白名单剥离全部身份 Cookie/Authorization。管理路径才转发必要的双会话。普通服务不解析/接受/记录管理 Cookie，也不持管理会话验证秘密；未知路径和编码绕过需测剥离规则。入口在剥离前也不得采集原始 Cookie。

`HttpOnly` 不阻止脚本携 Cookie 发请求，Cookie 的 Path 也不是 XSS 隔离。学生页与管理页同源，学生页 XSS、恶意扩展或前端供应链失陷仍可能尝试调用管理 API；双 Cookie、CSRF 和严格管理 CSP 只能缩小风险，不能承诺抵挡同源脚本已完全被控制。[MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

### 2.2 同站管理文档与升权启动

普通学生没有管理导航、工作区数据或管理 API 能力。`GET /admin` 及其受保护子路径由服务器先检查应用身份和数据库当前 `admin:enter`：未登录走统一登录且 `returnTo` 仅站内白名单，非当前管理员返回 403。当前管理员尚未升权时，只返回同一 `admin.html` 中的最小 MFA/重新认证界面，无业务数据、功能清单或私有 bootstrap；强认证成功后才装载工作区。

进入管理工作区使用顶层 document navigation，重新获取带严格安全头的 `admin.html`；不能在学生 SPA 中改 URL 后声称 CSP 已变化。学生页离开前停止 BYOK 请求并丢弃该页 Key/回答引用；管理文档及依赖图不装配 BYOK adapter、供应商连接、第三方脚本/统计或会话回放。管理 CSP 至少限定 `connect-src 'self'`、禁止 framing/对象和不受控脚本，按构建方式使用 nonce/hash；相关 HTML、MFA bootstrap、管理 DTO、错误和下载为 `no-store`。私有管理 DOM 不进入 Service Worker 或持久浏览器缓存。文档响应 CSP 的边界参考 [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)。

首期不注册可控制 `/admin`、`/admin.html` 或 `/api/v1/admin/**` 的根 scope Service Worker；`no-store` 本身不阻止已有 Worker 合成导航响应。若未来学生站增加离线能力，必须限定不覆盖管理入口/API 的 Worker scope，并验证升级、注销旧 Worker、导航与缓存清理；不能让客户端 Worker 绕过服务器文档准入或替换管理 CSP。

`/api/v1/admin/session`、`/session/elevate`、`/session/revoke` 是单独声明的会话生命周期协议：没有管理 Cookie 的合法管理员可以获取最小升权挑战，避免“先升权才可获取 MFA”循环。挑战使用应用会话与一次性 challenge 绑定的专用 CSRF，只能启动/完成升权，不能访问业务 API；升权成功后管理业务使用绑定管理会话的独立 CSRF。清除本人已失效的管理会话允许走受限清理路径，不能借此取得其他管理能力。其他管理 API 一律要求有效 `aal2` 升权；认证入口不能落入通用 handler 或未知 command 回退。

BFF 使用 Supabase Auth 验证登录结果与刷新会话，不信任仅 decode 的 JWT。使用受维护的 SDK/库校验签名、固定 issuer/audience、算法白名单、过期与 not-before，缓存 JWKS 并支持轮换。旧对称签名项目按官方验证路径处理，不把共享签名秘密分发给无关服务。[Supabase JWT 验证](https://supabase.com/docs/guides/auth/jwts)、[签名密钥](https://supabase.com/docs/guides/auth/signing-keys)

Auth SDK 的可变会话状态不能跨用户共享：按请求/会话隔离客户端或采用显式无状态调用，禁止模块级保存当前用户 token。刷新由 BFF 按同一供应商会话加有界互斥和版本 CAS，防多副本并发刷新后写回旧令牌；返回的 subject 必须与预期会话一致，失败终止会话。本文是自定义 BFF 会话方案，不直接使用把供应商 token 暴露给浏览器的默认 SSR Cookie 方案。[Supabase 服务端会话注意事项](https://supabase.com/docs/guides/auth/server-side/advanced-guide)、[刷新令牌与会话](https://supabase.com/docs/guides/auth/sessions)

应用封禁、学生grant撤销、管理授权变更由应用数据库当前记录控制，关键写命令在事务中重查，不依赖长期 token 的 role。学生grant初版不自动到期，仅证明首次验证时学生。Supabase 侧禁用/注销的传播与 JWT 有效期不是同一概念：管理升权及高风险操作在线确认身份状态，普通私有操作可采用最多 5 分钟供应商状态缓存；P0 固定此窗口并测试。应用内紧急封禁与管理撤权必须即时写入应用状态，不等待供应商同步。管理每请求都读取当前 capability/scope/version，不沿用普通私有操作的供应商状态缓存窗口。

### 2.3 五权限组、Capability与授予范围

用户主分类固定五组。`mainGroup`单值：当前显式管理组优先，否则按独立active学生grant派生学生/用户，未登录为游客且不落游客行。管理两组互斥、组无数字继承；管理员学生行为仍须独立grant。管理授权采用 `组允许集合 + admin:enter + 动作 capability + 学校/资源 scope + 对象/状态条件`，缺一拒绝。`private.role_bindings`仅保存显式管理组绑定，`private.capability_bindings`记录组内缩减权限、范围、依据与版本，不能给内容管理员增授系统cap。`isAdmin`、前端菜单、bundle和URL不构成权限边界。[OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

| 权限组 | 职责上限 | 不自动获得 |
| --- | --- | --- |
| 系统管理员 `system_admin` | 系统/账户权限、教学数据导入、AI配置预算/秘密、受控运维 | DB owner、无审计全权、学生资格、学校身份/查重读取 |
| 内容管理员 `content_admin` | 评价/举报/申诉、脱敏分析/总结治理、受限内容修正 | 系统配置/授权/秘密/运维能力、原分改写、学校身份读取 |
| 学生（认证） `verified_student` | 用户能力、scope内评价/点赞和BYOK数据工具 | 管理能力、当前持续在校或已修读证明 |
| 用户 `user` | 公开查询、本人记录/补救、发起学生认证 | 学生专属新写入或管理能力 |
| 游客 `guest` | 获准公开查询/阅读 | 私有数据、学生或管理能力 |

具体动作以[14](14-admin-workspace-and-security.md)注册表为准；组内按学校/资源再缩小，system_admin也逐动作授权，不自动取得所有内容权限。用户可修改的metadata、昵称、邮箱、自报学校均不能授予管理或学生资格。工作负载模式和SQL账号不是额外用户组。

授权变更要求system_admin当前强认证、专门授予能力和**可授予范围**；持有某能力不等于可转授。只授注册表和目标组上限内、未超出当前grant scope的项，禁止自升权、隐式通配或改组内配置变相越组。保护最后一个有效system_admin，撤销/降权/封禁/管理授权到期变更须同事务锁定治理记录并检查合格继任，不能靠UI数量判断；初始至少两名独立system_admin支持规定的高影响双人复核，不给所有操作增加审批。

### 2.4 学生匿名认证

学生验证与平台登录分开。独立平台Auth令牌可由BFF保管；学校proof、subject/凭据/token及材料只在隔离`apps/student-verifier`获准内存流程出现，不接成Supabase Auth provider/linkIdentity，不进metadata或持久介质。默认优先无真实联系方式的平台凭据/恢复适配器（P0验证）；可选邮箱只接受独立非校园联系方式，已知学校域准入拒绝，不从认证流提取/填充或用作学生证明。自愿平台联系方式按自己用途说明，详见[15](15-anonymous-student-verification.md)。

采用完整32字节HMAC-SHA-256：固定域+学校+canonical namespace+稳定subject用确定长度前缀编码，KMS秘密仅verifier可用。MD5/裸SHA和公开盐无法抵挡低熵学号字典。多issuer必须归一身份，不提供任意学号MAC/是否领取查询。查重集合仅key_version/tag，无账号/grant/challenge/时间/IP关联；grant仅独立平台状态/scope/策略/版本，无tag。零原文及密文要求覆盖入口/WAF/APM、URL/异常、SQL参数、Auth、Redis、队列/对象、诊断、dump和备份，人工同样不能存材料。

认证前创建无校园信息的会话challenge；verifier先校验proof并计算全部历史tag，再由受控单PG事务锁定keyring/账号/challenge，查重/插入当前唯一tag、创建grant并消费challenge。原文不进DB，标签参数不打印；不先烧tag再异步发券。响应丢失查原账号grant，已有grant不消费第二身份。删除/撤销保留spent tombstone，不自动续证或换绑，账号恢复只用既设平台凭据。历史Key/查重水位不完整或泄漏暂停新认证，不能清表或套用普通15分钟RPO继续发资格。主库高权、WAL/xmin与时序仍可能关联，不能宣称密码学不可关联或跨身份自然人全球唯一。

### 2.5 管理请求与异步执行

所有写、私有读、学生 AI 数据请求与管理操作同时验证“谁、作用域、对象、当前状态”；返回 DTO 再做字段白名单。同 origin 的 `/api/v1/admin/**` 由入口转发到隔离 `admin-api`，普通 API 不注册管理路由、不接受管理 Cookie 代授权，也不持管理 DB 凭据。管理 API 仍非 owner、非 BYPASSRLS，不使用 Supabase service-role 绕过权限。

`expectedVersion`、幂等键和追加审计应用于管理修改；幂等命中时也先重查当前授权，撤权后不能凭旧 key 取回私有结果或再次执行。`private.admin_command_jobs` 绑定发起人、当时批准的 action/scope/参数摘要与授权版本，queued/running 作业在领取、关键副作用前及条件提交前重新核验发起人当前状态、capability、scope、撤销状态和任务 fence。权限变化立即阻止后续未执行步骤；已发生的外部副作用不能假装撤回，记录实际状态、停止后续并进入受控恢复。

长作业只使用固定时限、固定动作与摘要的任务授权，不携带浏览器 Cookie。短时升权不是无限期执行委托；需新鲜强认证的步骤若授权时窗已过，暂停并由同站工作区重新认证/确认，不能依赖过期 admin 会话继续执行。机器定时任务使用独立工作负载授权；不得把已撤权人的旧作业改成“系统任务”继续运行。

平台 AI 常规任务只由受控事件或当前获准管理员触发，不提供学生创建入口；平台模型和普通 worker 也不自动取得管理 command-runner 权限。对无权访问的私有对象统一 404，认证失败 401，已知动作无权限 403，内部不泄漏 SQL 或策略名。

## 3. CSRF、跨域和浏览器防护

- 本站普通修改请求必须是JSON，验证精确Origin、同源CSRF header及绑定session的token；管理CSRF另绑升权会话，bootstrap仅限升权。学校issuer的专用proof回调使用固定有界form/后端协议，以事先由本站CSRF创建的challenge、state/nonce/PKCE、可信proof及会话绑定复验，不能套普通handler或靠跨站Cookie放行。不能仅依赖SameSite/Referer/路径。
- 登录/OTP 也检查 Origin、一次性挑战与限流，防止登录 CSRF。若接 SSO，校验 state、nonce、PKCE、一次性回调和固定重定向目标，禁止任意 returnTo。
- 本站任何GET都不能修改业务状态；健康检查不触发修复或刷新任务。本站跨站请求默认拒绝，不使用凭据+`*`；学生模型另走注册表供应商CORS直连，`credentials: omit`，不携本站Cookie/CSRF。
- 学生文档 CSP 限制 registry 供应商；管理文档使用独立更严格 CSP、`connect-src 'self'`、无 BYOK/第三方脚本。顶层导航重新加载文档，不能由 SPA/meta 标签声称放宽或切换既有响应安全头。部署 HSTS、nosniff、Referrer-Policy 和 Permissions-Policy；浏览器验收覆盖直接深链、刷新、返回/前进、登录后跳转和 Service Worker 绕过。
- 评价默认纯文本，允许 Markdown 时禁用内嵌 HTML，统一过滤危险协议与外链；禁止 `dangerouslySetInnerHTML` 渲染用户或模型文本。外链加安全 rel，供应商错误正文不得直接回显。

CSRF 的独立 token 与 Origin 检查依据 [OWASP CSRF 指南](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)；具体请求协议由本项目确定。

## 4. 评价匿名性与治理

“匿名”指面向其他学生不展示稳定作者标识，不承诺运营方完全无法关联。公开 DTO 禁止 user_id、author_id、审核者 ID、邮箱、学号、可关联昵称、来源原始数据、驳回原因和精确个人时间线。正文仍可能被作者自行写入身份线索，提交提示与审核需要处理这种风险。

内容管理员获得脱敏内容、课程和风险提示；系统管理员可在获准`accounts:audit-behavior`/scope内通过同站平台行为case核查必要平台账号事实，按风险使用intent/限时目的约束并留审计。无真实学校身份揭示、校园账号反查或tag查询功能，即使双人批准也不启用。普通审核、授权界面、任务日志和导出不顺带返回稳定作者映射；不得通过堆栈、CSV、埋点或AI绕过隔离。

评价遵循允许批评教学、禁止个人信息曝光/威胁/捏造事实的规则。敏感词和模型仅辅助标注，不能自动认定事实真假或自动发表。争议内容人工核查；提供教师更正、学生申诉与紧急隐藏入口。处理规则、申诉时限和联系渠道在上线前明确，不在技术文档中虚构法律结论。

撤稿语义：撤稿事务提交之后新发起的正文读取必须先查主库当前公开状态；仅按已公开修订/版本取正文，任何授权检查失败都不返回缓存旧正文。提交前已授权的在途响应可能完成；客户端收到撤稿事件尽力清理，无法收回已下载副本。目录摘要允许短暂滞后，需显示更新时间，不能继续夹带旧正文。

AI派生内容也受撤稿控制：学生浏览器取得证据后、展示解释前向主库验证完整证据集和当前资格；失败丢弃该轮解释，不自动重复付费请求。平台总结通过完整manifest与teacherSummaryEpoch在提交/每次读取时主库gate，来源集变化同事务使旧总结失效。已发往学生供应商的资料无法由本站收回，诚实客户端检查不能约束已修改浏览器。两类链路详见 [12](12-student-byok-ai.md)、[13](13-platform-ai-analysis.md)。

平台置信度仅描述内容证据强度/一致性，不能将未经校准等级解释为真假概率，不能因为负面分、少数意见、表达能力或敏感属性降低作者信誉。初版不自动发表/删评、不改原始评分、不按置信度加权教师总分；审核员查看明确的限制和依据，争议可人工复核。待审评价只有平台data bridge按指定revision返回脱敏内容，学生接口与平台总结不得读取它。

## 5. 请求、滥用与缓存边界

入口限制 body、header、URL、连接与解析时间；API 对 endpoint、用户、学校、IP/网段、资源维度实行有界限流。真实 IP 只从可信反代链解析，不能相信任意 X-Forwarded-For。校园 NAT 不能成为单一封禁依据；用户配额与异常风险结合。

示例初值：学生提交5次/小时、20次/日；OTP分层限流；学生页面每次1个模型流程属于本地保护，本站只对search/evidence/validate限制用户频率、复杂度和并发，不承诺控制外部模型费用。平台分析另有供应商并发与货币预算，不影响学生BYOK准入。公开查询按全局/路由回源预算保护，IP阈值覆盖校园NAT，不能按单人频率限制校园出口。压测同时验证生产限流和共享出口策略，所有初值由误伤观测调整。

幂等key和缓存key均非授权凭证。用户当前页状态按session/actor隔离，退出清除。共享缓存只容纳公开且身份无关表示，private/auth/admin/AI和错误均no-store，公共handler不Set-Cookie；CDN规则与Cache-Control共同验证。[HTTP Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)

数据库缓存统一后端管理，前端仅当前页状态；每日将白名单目录缓存写Supabase PostgreSQL非公开cache_persistence表，专用低权限SQL凭据仅后端。schema不暴露Data API，撤anon/authenticated/default grants并RLS默认拒绝；不把账号作者/权限/认证/raw/tag/Key或整库dump落入缓存表。写分片/激活/加载/清理port按scope约束，无owner/service-role万能权限；日副本不替代当前新鲜度/撤稿/认证恢复事实，见[16](16-backend-cache-and-daily-sync.md)。

查询缓存Redis异常时限额回源；会话安全存储异常关闭受影响私有接口与学生证据能力。平台分析账本/模型异常仅暂停平台任务，不关闭普通评价提交、人工审核或仍能安全服务的学生BYOK数据接口。禁止无上限旁路数据库，具体预算见 [06](06-capacity-and-performance.md)。

## 6. 密钥、网络与导入

DB、Auth 管理、平台模型、Redis、CDN purge 和会话密钥分用途/环境管理，不进入 git、普通文档、构建或埋点。管理 UI 只能读 `keyRef`、版本、是否配置、掩码状态和最后轮换时间，绝不 GET 原文。获授权的秘密替换先签发短期一次性写票据，绑定 actor/adminSession、秘密写 capability、keyRef、expectedVersion、供应商 origin 与 scope；专门 no-log、write-only handler 复验后，把新值直接写入密管 stagedVersion，`apps/command-runner` 的 `secret-write` 模式只负责获准槽位写入/激活。

秘密原文不经过普通 admin handler 解析/排队，不进入通用 command payload、operation intent、job JSON、队列、APM、审计或幂等 body 摘要。专用写入用一次性 writeNonce 防重放，重复票据409并核对不含原值的配置状态；通用 intent/job 只引用 keyRef/stagedVersion/目标版本，按策略确认激活，不能暗藏原值或其 body hash。受管控粘贴字段只在该管理文档短期内存、专用 TLS 写 transport 与密管中出现，写完即清引用；这项专门授权不是允许保存或上送学生 BYOK Key。

学生自己的模型 Key 仍只存在学生页面内存与所选供应商鉴权 header，本站 AI 数据接口与会话/管理功能不接收、不代理、不保存它；schema 拒绝 `apiKey/providerKey` 等未知字段且不回显。普通 API 无 Supabase 管理密钥。秘密扫描只报告位置与类型，不输出值。

数据库/Redis尽量私网且TLS，API只经可信入口。平台模型executor出网仅获准供应商，浏览器BYOK仅注册表HTTPS目标，学生输入Key是有意支持的输入但不能改变任意URL/内网地址。平台SSRF防护覆盖重定向、DNS与元数据地址；浏览器设置redirect:error，CSP限定connect-src。AI无通用抓取工具，CORS失败不触发本站/第三方代理。

Key配置区禁用第三方session replay与请求采样，前端错误只报受控分类。切换供应商清Key、离开页面/退出取消调用并清引用；不存localStorage/sessionStorage/IndexedDB/Cookie/Service Worker。内存方式不能抵挡XSS或恶意扩展；构建完整性、CSP和安全渲染仍为发布前置。[BYOK细节](12-student-byok-ai.md)

导入文件先隔离存储，限制大小、行数、格式、解压比和处理时间；不执行宏、公式或用户表达式。CSV 导出处理公式注入；显示路径与内容做转义。原始文件不放公共静态目录，发布先 dry-run、差异预览与审计；异常映射进入人工确认。

### 6.1 日常管理能力全量接入

同站工作区必须有前端页面和受控API覆盖：评价/举报/申诉、目录/映射/导入、匿名grant状态/撤销/恢复原grant、账号/隐私、平台AI报告/总结、registry/模型/预算、组权限/审计/平台行为核查、开关/限流/缓存/队列、备份恢复发布。按system/content组上限及当前capability显示/操作；不提供学校材料/身份/标签读取或管理员手工首次授学生资格。日常UI不能以“高风险去终端操作”替代。

普通低影响领域修改直接采用受控 JSON 命令、对象授权、幂等和 expectedVersion；只有关键高影响动作采用同站 `preview → operation intent → 确认/必要二次认证 → command job`。`private.operation_intents` 绑定动作枚举、规范参数摘要、目标版本/scope、发起人、授权版本和短有效期，执行时重验并原子消费；批准后改参必须重新预览。必要双人流程由具体动作策略决定，不阻塞全部请求。参数绑定与执行前校验原则参考 [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)。

安全、运维与密管执行由 `apps/command-runner` 的 `security`、`ops`、`secret-write` 三种独立能力模式完成；每种持有自己的最小基础设施权限，管理 API 不携这些执行秘密。操作由服务器闭集注册表决定，不接受任意 command 字符串、SQL、shell、脚本、备份 URL、制品 URL 或自由资源路径。恢复只选已登记恢复点，发布/回滚只选校验的制品与环境；页面显示差异、影响与恢复点，结果返回受控摘要，不能展示原始 runner 输出。

system_admin不是数据库owner；开关/限流/缓存/队列不能关闭认证、CSRF、RLS、审计、正文/总结gate、一次认证查重或扩张执行权限。初始两名system_admin引导和灾难break-glass是限时受审计运维路径，恢复后回收/轮换，不成为匿名自举或隐藏万能账号，也不绕过校园原文零留存要求。

## 7. 安全验收底线

上线前至少证明：Supabase 直读不能取得基础表/身份；低权限不能提权/发布，池化身份不串用；双用户私有对象隔离，撤稿后新请求无旧正文/派生总结，缓存不串用户。合成学生 Key 只到选定供应商，不到本站/存储/遥测，CORS 失败无 relay；恶意学生模型不能越权。平台任务重放/取消/未知调用受预算与容量保护，置信度不自动改变审核或总分。

管理验收覆盖五组分类/管理组互斥、内容组不能增授系统cap、管理员无grant不能使用学生API、非管理无工作区/DTO能力；MFA启动、独立CSP、同源XSS风险、双Cookie/CSRF绑定与撤销；每动作scope/对象/自审、授予范围/最后system_admin保护及初始两人；旧幂等/queued作业不续权、intent防调包重放、受限runner/秘密零GET日志；所有日常管理功能UI/API齐全。安全运维需真实演练。

认证验收按[15](15-anonymous-student-verification.md)覆盖可信proof与统一规范、同身份/同账号并发、响应丢失、轮换/恢复/删号/撤销与平台账号补救；合成校园数据canary在所有持久出口均不得出现原文/密文，Auth.identities不能自动落库，tag无平台业务关联列或管理查询。历史key/账本水位不完整时新认证fail closed；已有可安全核验grant和公开查询分别运行。

每项保留测试输入、预期拒绝点、实际状态码/数据库结果和请求追踪 ID。安全控制未通过时关闭相关功能，不用“有 RLS”“有 WAF”“提示词要求遵守规则”替代验收。
