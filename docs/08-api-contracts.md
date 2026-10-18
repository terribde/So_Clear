# HTTP API 与数据契约

## 1. 基本约定

API 前缀 `/api/v1`，JSON UTF-8。学生与所有日常管理功能使用同一前端站点、同一 origin；`apps/web` 中的 `/admin` 是受保护的管理工作区，不另建 `apps/admin` 或管理域名。入口将 `/api/v1/admin/**` 转发到隔离 admin-api，其余 API 按职责路由，管理执行凭据不进入普通服务。

应用使用 `__Host-sc_session`，管理业务另要求绑定应用会话的短时 `__Host-sc_admin` 与当前 `aal2`。业务修改带 `X-CSRF-Token` 与 `Idempotency-Key`（认证挑战按一次性协议）；管理 CSRF 绑定管理会话，不能复用学生 CSRF。学生 AI 只读 POST 携应用 CSRF，无模型作业/消费副作用，无需用幂等键防模型扣费。浏览器不持 Supabase/数据库/运维令牌；学生自填供应商 Key 仅浏览器直连，本站学生/普通管理接口不接收。平台秘密替换只有第 8 节的专用 write-only 协议可接收获授权的平台秘密，绝不是学生 Key 上传入口。

公开读取采用 `/public/**` 的显式白名单；私有接口不提供匿名回退。路由按业务资源命名，与代码域不要求机械一一对应。接口与 DTO 存入 contracts，运行时 schema 和 OpenAPI 在 P1 同步生成/校验；本文为初步契约，不声称已有可调用服务。

成功示例：

```json
{
  "data": { "items": [] },
  "meta": {
    "generatedAt": "2026-10-18T08:00:00Z",
    "dataVersion": 12,
    "page": { "nextCursor": null, "hasMore": false }
  },
  "error": null
}
```

失败示例：

```json
{
  "data": null,
  "meta": { "requestId": "server-request-id" },
  "error": { "code": "VALIDATION_FAILED", "message": "请检查筛选条件", "fields": [{ "path": "limit", "code": "OUT_OF_RANGE" }] }
}
```

每次响应以 `X-Request-ID` 标识此次请求，由入口生成或安全规范化；命中CDN时也生成本次ID。可缓存正文无逐请求requestId、用户/IP，generatedAt为表示生成时间；私有/错误正文可附requestId。Cache-Status/Age/缓存命中头与正文分离。304无JSON正文；本站无学生模型事件流，AI只读JSON协议见第6节。

## 2. 路由草案

`Q`=真正公开目录缓存；`R`=公开但正文 HTTP no-store、主库状态栅栏；`P`=私有 no-store。所有缓存类别需服务端声明，未声明按 P。

| 方法 / 路径 | 作用 | 权限与缓存 |
| --- | --- | --- |
| GET /public/teachers | 姓名/学院/课程/学期/评分筛选 | 访客，Q |
| GET /public/teachers/:teacherId | 公开资料、评分摘要和数据时间 | 访客，Q；不内嵌评价正文 |
| GET /public/teachers/:teacherId/ai-summary | 当前有效的平台教师总结或不可用状态 | 访客，R；完整来源/epoch主库gate，no-store |
| GET /public/teachers/:teacherId/reviews | 当前公开评价，游标分页 | 访客，R |
| GET /public/reviews/:reviewId | 当前公开修订 | 访客，R；撤稿返回 404 |
| GET /public/departments | 学院字典 | 访客，Q |
| GET /public/courses | 课程搜索 | 访客，Q |
| GET /public/terms | 学期字典 | 访客，Q |
| GET /public/sections | 学期/课程/教师/校区/时间筛选 | 访客，Q |
| GET /public/sections/:sectionId | 单个开课、共同授课与安排 | 访客，Q |
| POST /auth/otp/request | 可选独立平台邮箱登录挑战 | 非校园平台凭据，不从学生认证取邮箱；Origin、反滥用，P；独立匿名登录适配器P0验证 |
| POST /auth/otp/verify | 验证挑战并建立会话 | 一次性挑战、防重放、Origin，P |
| GET /auth/session | mainGroup、独立grant最小状态、应用CSRF和isAdmin提示 | 本人，P；固定五组分类，提示不授管理/学生能力 |
| POST /auth/logout | 撤销当前会话 | 本人+CSRF，P |
| GET /me/reviews | 本人评价、私有审核结果 | 本人，P |
| POST /me/reviews | 新建待审评价 | 有效学生，P，201 |
| POST /me/reviews/:reviewId/resubmit | 新修订，已公开旧版同步撤下 | 本人+有效学生+expectedVersion，P |
| POST /me/reviews/:reviewId/withdraw | 撤回并立即撤除公开正文 | 本人控制权+expectedVersion，P；不要求仍在校 |
| POST /me/reports | 举报公开内容 | 有效账号；风险限流，P |
| POST /me/appeals | 本人评价或处理结果申诉 | 本人，P；学生grant撤销后仍保留本人补救 |
| GET /me/student-verification | 本人匿名资格状态/学校scope/恢复提示 | 本人，P；只含未认证/首次验证时学生/已撤销/暂不可用，无校园字段/tag |
| POST /me/student-verification/challenges | 认证前创建绑定平台会话的短期challenge | 本人+CSRF/准入，P；无学校身份/tag，scope为服务端受限值，默认5分钟 |
| POST /me/deletion-requests | 账号/个人信息删除请求 | 本人重新验证，P |
| GET /public/ai/providers | 非秘密的浏览器直连供应商注册表 | 访客，Q；不含Key、用户配置或实时兼容保证 |
| POST /ai/student/search | 校验模型DSL，返回规范条件与确定性候选 | 有效学生+CSRF，P，200；无Key/原始对话 |
| POST /ai/student/evidence | 按公开候选获取最小证据和短期签名票据 | 有效学生+CSRF，P，200；主库可见性检查 |
| POST /ai/student/evidence/validate | 重验完整证据集/资格/版本 | 有效学生+CSRF，P，200或受控失效错误；不触发模型 |
| GET /health/live | 进程活跃 | 仅最小状态，不查全表 |
| GET /health/ready | 流量准入 | 内部入口，受依赖状态控制 |

五组canonical ID为system_admin/content_admin/verified_student/user/guest；mainGroup单值，管理组互斥且不按数字继承。表中“有效学生”均指当前独立active、未撤销grant且scope满足，管理员也不豁免；grant仅证明首次验证时学生，初版无自动到期/续证/换绑。user可发起认证和本人补救，guest只公开读；group/grant/capability禁止客户端自报。无`POST verified=true`、续证、标签查询或管理员首次授学生资格路由。

校园回调使用专用非通用handler，由入口送`apps/student-verifier`。固定issuer的POST proof/callback采用单独有界form/后端协议、state/nonce/PKCE与可信proof校验，不套普通JSON/Origin-CSRF规则；其challenge已由本站会话+CSRF创建，并在领取时核验绑定会话有效。校园原文/code/token、tag或内部断言不进入普通BFF/Auth、通用幂等body/结果、日志/trace或队列。只返回同平台账号的最小状态，详见第9节和[15](15-anonymous-student-verification.md)。

### 2.1 管理文档与会话生命周期

下表的 HTML 路径不带 API 前缀；所有 `/admin/...` JSON 路由均位于 `/api/v1/admin/...`。管理业务权限统一为：双会话绑定有效、`aal2`、数据库当前 `admin:enter`、对应动作 capability、当前学校/资源 scope 及对象/状态条件，简写为 **A**；修改另带管理 CSRF、幂等和版本。各功能的具体 capability 映射见 [14 管理工作区](14-admin-workspace-and-security.md)，服务端不能仅相信页面隐藏按钮或 `isAdmin`。

| 方法 / 路径 | 作用 | 权限与响应 |
| --- | --- | --- |
| GET /admin、/admin/*（HTML） | 服务端准入后的 `admin.html` 文档入口/深链 | 应用身份+当前 admin:enter；未登录到统一登录白名单 returnTo，非管理员403；未升权只给最小MFA壳，无工作区数据；HTML no-store |
| GET /admin/session | 最小升权状态，或当前管理会话摘要/管理CSRF | 会话生命周期专用协议；未升权只给当前有admin:enter者一次性升权挑战信息，非管理业务DTO |
| POST /admin/session/elevate | 开始/完成强认证并建立/轮换升权会话 | 应用身份+当前admin:enter+精确Origin+挑战专用CSRF；一次性MFA证明经服务端在线验证，不接受客户端自报aal/authTime |
| POST /admin/session/revoke | 退出当前管理升权 | 管理CSRF；本人已过期/撤权会话可用受限清理协议，不授予任何业务权限，204 |
| GET /admin/capabilities | 当前有效动作、scope与授权版本提示 | A；no-store；仍须每个后续请求重新查当前授权 |
| GET /admin/management-registry | 当前可见的功能/动作与路由注册表 | A；只返回当前范围允许项及可解释的禁用原因，不返回可执行脚本或内部凭据 |

学生文档进入管理区必须顶层 document navigation，重新请求带独立严格 CSP 的 `admin.html`，不能以 SPA 改路由替代。管理 `connect-src 'self'`、无 BYOK adapter/供应商连接/第三方脚本/会话回放；先中止并清理离开的学生页面配置。直接请求 `admin.html`、深链、刷新、MFA壳与返回/前进都走服务端文档准入，不存在静态裸 HTML 绕过入口。代码 bundle 可被发现，不能内嵌管理数据或被当成秘密。

首期没有可控制管理入口/API 的根 scope Service Worker，管理文档和 JSON 不由 Worker 合成或离线回退；只设置 no-store 不能证明导航会经过服务端准入。未来引入学生站 Worker 时先验证 scope 不覆盖 `/admin`、`/admin.html`、`/api/v1/admin/**`，并清理不兼容旧 Worker。

两个 `__Host-` Cookie 都是同 host、`Path=/`，不提供同源 XSS 隔离。边缘向非管理普通服务转发前剥离管理 Cookie，公共缓存白名单剥离全部身份；普通 API 不解析/验证管理 Cookie、不持管理会话验证秘密。后台强认证与管理文档 CSP 不能阻止已完全控制的同源脚本尝试携 Cookie 发请求，完整边界和验收见 [05](05-security-and-privacy.md)。

升权 bootstrap CSRF 只绑定应用会话/一次性 challenge 并仅用于 elevate；业务 CSRF 在成功后绑定新的管理会话。`elevate` 的 challenge/verify 使用固定判别 schema、有限 MFA 字段和 no-log 规则；`revoke` 失效会话清理单独定义，不能按“所有普通管理API都需已升权”产生启动/退出循环。其余未知 `/admin/**` API 默认404，不提供通用 handler 或自动映射命令。

### 2.2 同站管理领域路由

所有下列接口均为 A、P/no-store；读列表默认游标分页，实际动作 capability、scope 和风险级由当前版本注册表确定。表中的直接 JSON 修改仅适用于注册为低影响的动作；同类资源的合并、批量删除、授权、恢复等高影响变更走第 8 节 intent/command 协议，不能借一个通用 PATCH 绕过预览或新鲜认证。

| 方法 / 路径 | 同站前端功能 | 额外边界 |
| --- | --- | --- |
| GET /admin/reviews；POST /admin/reviews/:reviewId/decisions；POST /admin/reviews/:reviewId/hide | 评价审核与紧急隐藏 | 指定revision/expectedVersion；非作者审核；普通决定无需二次审批 |
| GET /admin/dashboard | 本人可见范围的管理概览/待办/告警摘要 | dashboard:read和当前scope；只聚合获准资源，不因概览暴露其他模块私有数据 |
| GET /admin/reports；POST /admin/reports/:reportId/decisions | 举报处理 | 当前学校/对象；不向无调查权角色提供作者映射 |
| GET /admin/appeals；POST /admin/appeals/:appealId/decisions | 申诉处理 | 私有理由最小化、处置历史追加审计 |
| GET /admin/catalog/:resourceKind；POST /admin/catalog/:resourceKind；PATCH /admin/catalog/:resourceKind/:resourceId | 教师/学院/课程/学期/开课目录创建与维护 | resourceKind闭集；固定schema，非表名/自由列选择；关联有效性与来源审计，合并/归档按相应注册动作，禁止任意硬删除 |
| GET /admin/catalog/mappings；POST /admin/catalog/mappings/:mappingId/decisions | 教师同名/来源歧义映射 | 指定来源版本与候选；不以姓名静默合并 |
| GET /admin/imports；POST /admin/imports；POST /admin/imports/:batchId/dry-run；GET /admin/imports/:batchId/preview | 导入批次、dry-run与差异预览 | 文件隔离、大小/解压/格式限制；创建或dry-run不是公开发布 |
| GET /admin/accounts | 平台账号治理 | system_admin+accounts:manage及对象scope，无校园账号或作者映射顺带返回 |
| GET /admin/student-verifications；POST /admin/student-verifications/:grantId/decisions | 已有匿名grant状态/撤销/按平台原因恢复原grant | system_admin+students:manage-grant；只active/revoked+scope/版本，不授新grant、不换绑、不收校园材料或读tag |
| POST /admin/accounts/:accountId/restrictions | 封禁/解除限制 | system_admin当前capability、对象版本/原因；影响管理员/批量范围走intent与最后system_admin保护 |
| GET /admin/privacy/deletion-requests；POST /admin/privacy/deletion-requests/:requestId/decisions | 隐私删除申请处置 | 决策与执行分开；实际删除、保全或大范围导出按专门作业策略执行 |
| GET /admin/reviews/:reviewId/ai-assessment | 指定修订置信度辅助报告 | 脱敏、目标当前有效；无作者映射、不改原评分 |
| GET /admin/platform-ai/jobs；POST /admin/platform-ai/reanalysis | 平台分析任务/固定目标重分析 | 固定kind/revision/scope/version，独立预算/去重，禁止任意prompt执行 |
| GET /admin/platform-ai/summary-candidates；GET /admin/platform-ai/summary-candidates/:candidateId；POST /admin/platform-ai/summary-candidates/:candidateId/decisions | 总结敏感/争议例外复核 | expectedCandidateVersion+摘要+完整manifest/epoch；不依赖旧worker租约，不阻塞正常合格总结自动发布 |
| GET /admin/ai/providers；GET /admin/ai/config-versions；POST /admin/ai/config-versions | 供应商registry、模型/prompt/rubric版本 | 固定配置schema、仅引用keyRef，先建版本；启用策略另按发布风险门禁 |
| GET /admin/ai/budgets；PATCH /admin/ai/budgets/:budgetId | 平台成本预算 | 货币/周期/范围/版本；提高高影响上限按intent，不是学生积分/余额 |
| GET /admin/authorization/bindings；GET /admin/audit-events | 授权范围与审计 | 专项查看capability、作用域过滤，不能以审计接口读取秘密/原始日志 |
| GET /admin/account-cases；GET /admin/account-cases/:caseId | 平台账号行为核查case/受限结果 | system_admin+accounts:audit-behavior及目的/目标/期限；无校园身份揭示、tag或真实账号反查 |
| GET /admin/operations/config；PATCH /admin/operations/config/:configId | 功能开关、限流、安全范围内配置 | 版本化白名单；不得关闭认证/CSRF/RLS/审计/撤稿gate |
| GET /admin/operations/cache；GET /admin/operations/queues | 缓存与队列状态/动作入口 | 状态摘要，定向刷新/暂停/恢复/重试按注册动作执行，不允许删除事实事件或清会话存储 |
| GET /admin/operations/metrics；GET /admin/operations/events | 站内监控/告警/事件/受控日志摘要 | 对应只读capability与学校/环境scope，固定指标/时间窗/分页，无原始凭据或全文任意日志查询 |
| GET /admin/operations/backups；GET /admin/operations/releases | 备份/恢复点与发布/回滚制品 | 仅登记资源元数据/健康状态，无数据库密码、签名下载URL或shell命令 |
| GET /admin/secrets | 已授权平台秘密配置状态 | 仅keyRef/版本/掩码/状态，无任何原文；替换另走专用write-only入口 |

组权限授予、平台行为核查、导入发布、隐私实际删除、高影响配置/缓存操作和备份恢复发布均在同站提供页面/命令。content_admin仅能执行[14](14-admin-workspace-and-security.md)内容cap集合：报告/总结治理、固定目标且既有预算内重分析、窄范围内容更正；配置/registry/预算/秘密/授权/运维属于system_admin且仍逐动作授权。安全运维由独立runner执行，普通管理DB角色非owner/service-role；初始两名system_admin引导及灾难break-glass为受审计例外，不替代日常UI。

## 3. DTO 白名单

| DTO | 必要公开字段 | 不能包含 |
| --- | --- | --- |
| TeacherDTO | public id、name、department、confirmed course ids、ratingSummary、dataVersion、updatedAt | 来源原始记录、学生/管理身份 |
| RatingSummaryDTO | schemaVersion、publishedCount、eligible、scores 或 null、statsUpdatedAt | 被阈值抑制的平均值、sum、内部贡献 |
| PublicReviewDTO | public id、teacher/course/term public id、当前正文、四维分、描述项、publishedAt、revision/generation | author/user_id、昵称关联、审核人、私有原因/时间 |
| OwnReviewDTO | 本人内容/修订/状态、处理原因摘要、version、可执行动作 | 他人信息、内部举报/风控细节 |
| SectionDTO | public id、课程/学期、教师映射状态、校区、周次时间地点、容量快照、sourceUpdatedAt | 原始 source_row、导入内部 key、学籍名单 |
| SessionDTO | authenticated、mainGroup、公开展示名（可选）、studentGrant最小状态、isAdmin提示、应用csrfToken | 管理授权凭证、管理csrfToken、校园身份/tag/证明、供应商令牌、内部授权详情 |
| StudentGrantStatusDTO | state、schoolScope、assurance=verified_at_claim、version、允许本人动作/恢复提示 | 学号/学校账号/邮箱/姓名、subject/token/材料、tag/key版本、关联challenge或历史身份 |
| StudentVerificationChallengeDTO | 不透明一次性challenge、固定验证入口、expiresAt | 平台userId、校园身份、tag、可换绑领取券、任意returnTo |
| AdminSessionDTO | elevated、aal、authTime、expiresAt、idleExpiresAt、roleVersion/sessionEpoch、管理csrfToken、scope摘要 | 原始Cookie、Auth token、密钥或未经验证的客户端角色 |
| AdminElevationChallengeDTO | challengeId、固定MFA方法提示、expiresAt、仅用于升权的bootstrapCsrfToken | 管理业务数据、管理CSRF、Supabase访问/刷新token、可重放认证凭据 |
| AdminCapabilitiesDTO | 当前有效capability、允许scope、可授予范围提示、roleVersion、sessionEpoch | 不在范围的绑定、作者映射、通配全权承诺；提示不能代替服务端授权 |
| ManagementRegistryDTO | registryVersion、获准featureId/页面route、动作枚举/参数schema版本、当前状态/禁用原因、所需capability提示 | 可执行远程脚本、SQL/shell、秘密、未授权功能的数据 |
| AdminPageDTO | items、nextCursor/hasMore、scope摘要、snapshot/version提示 | 任意表/字段选择、无范围全量导出、其他学校私有记录 |
| OperationIntentDTO | intentId、intentVersion、操作枚举、规范影响预览、参数摘要、scope/目标版本、expiresAt、新鲜认证/确认/必要第二人状态 | 原始秘密、自由命令、可扩张目标的客户端授权声明 |
| AdminCommandJobDTO | commandJobId、固定操作/目标摘要、executionState、步骤/进度、version、可执行动作、受控结果/错误 | runner原始stdout/stderr、SQL、shell、密钥、作者库或任意供应商响应 |
| SecretStatusDTO | keyRef、secretVersion、configured、maskedStatus、lastRotatedAt | 原文、可用于重构秘密的片段/签名URL；掩码不用于泄露固定前后缀 |
| SecretWriteTicketDTO | writeNonce、目标keyRef/expectedVersion/固定origin、expiresAt | 原值、Auth token、可跨会话/目标复用的写能力；票据不进日志 |
| SecretStageDTO | keyRef、stagedVersion、受控写入/激活状态 | 新旧原值、原值hash、可下载秘密的链接 |
| BrowserProviderDTO | providerId、展示名、固定HTTPS目标/协议、支持状态、兼容验证时间、registryVersion | 学生Key、平台Key、可执行远程脚本、用户配置 |
| StudentSearchDTO | 规范条件、候选公开ID/确定数值/排序、歧义或未知项、dataVersion | 私有评价、任意SQL、学生模型请求/Key |
| StudentEvidenceDTO | 公开证据ID/修订/版本/必要节选、完整集合摘要、evidenceReceipt、expiresAt | 作者身份、待审内容、本站会话/CSRF、平台凭据 |
| EvidenceValidationDTO | valid、受控失效原因、当前数据版本、可核查引用/数值状态 | “模型解释真实”认证、私有差异详情 |
| ReviewAssessmentDTO | 指定修订、内容置信等级、维度/依据/局限、模型/rubric版本、人工处理状态 | 作者诚信分、未经校准真假概率、作者关联和风控原始数据 |
| TeacherAiSummaryDTO | state、scope、句子与站内引用、样本/覆盖、summaryVersion、teacherSummaryEpoch、generatedAt/dataAsOf | 待审资料、私有置信度、作者、内部完整manifest/供应商错误 |

JSON 中没有数据的字段使用 null 或明确状态，不能用 0 假装“未知评分”。后端序列化 schema 必须丢弃未列字段，契约测试包含“未来数据库加敏感列仍不出现在 DTO”的断言。

## 4. 筛选与分页

列表默认 limit=20、上限 50；教师/课程关键词最多 80 字符，ID 集合最多 20 个，排序枚举不接受原生 SQL 名称。无序含义的参数先去重/排序，统一 Unicode/空白规范，缓存与查询共用规范化结果；保留有序偏好数组顺序，不能任意重排改变业务语义。

默认 keyset cursor，包含排序字段、末尾稳定 ID、学校/查询摘要、dataVersion、过期时间与签名；客户端不能把其他筛选的 cursor 拼来使用。游标无效/过期 422 `CURSOR_INVALID`，数据版本切换 409 `DATASET_CHANGED`，前端重新开始分页。动态评价集合不承诺跨多页完全快照，客户端按 public id 去重；撤稿优先于分页快照。

区分版本：`dataVersion` 指一次原子发布的教学目录/课表数据集，`ratingSchemaVersion` 指评分口径，`publicationGeneration` 指某评价的公开修订。普通评价或评分变化不会提升整个目录数据集版本、使所有学生游标失效；动态评分排序允许分页期间重排，客户端去重并提供刷新入口，不承诺跨页遗漏为零。若将来需要严格快照分页，单独设计受限快照索引，仍不能绕过撤稿检查。

`teacherSummaryEpoch`是公开DTO/证据协议唯一使用的失效字段名，对应数据库core.teachers.teacher_scope_epoch与内部scopeEpoch；初版保守采用全教师水位。相关公开来源变化同事务提升，不能与dataVersion/缓存时间混用，旧epoch总结即使TTL未到也不返回。

不在每页强制 COUNT(*)。返回 hasMore/nextCursor；需要计数时使用独立缓存统计并标记估算/更新时间。深度 offset、全量列表和无限导出不作为公开接口；后台导出另做任务、权限和配额。

## 5. 写入、版本与错误

修改请求带 expectedVersion；SQL 使用锁或条件版本更新，冲突返回 409 `VERSION_CONFLICT`，不覆盖别人已完成的审核。Idempotency-Key 为客户端随机值，绑定主体/路由/规范正文摘要；同 key 同正文返回同一业务结果，同 key 异正文 409 `IDEMPOTENCY_CONFLICT`。并发处理中可返回 409 `REQUEST_IN_PROGRESS` 和 Retry-After，不重复执行命令。幂等命中仍先检查当前身份/capability/scope，旧结果不是撤权后的读取或执行凭证；专用秘密写入不将原文装入通用摘要/幂等结果，按第 8 节一次性写协议处理。

| 状态 | code 示例 | 客户端处理 |
| --- | --- | --- |
| 400 | MALFORMED_REQUEST | 修正 JSON，不自动重试 |
| 401 | UNAUTHENTICATED / SESSION_EXPIRED / ADMIN_ELEVATION_REQUIRED / ADMIN_SESSION_EXPIRED | 在同站完成登录/管理升权，不回退为应用身份执行管理动作 |
| 403 | FORBIDDEN / STUDENT_VERIFICATION_REQUIRED / CSRF_FAILED / CAPABILITY_DENIED / ADMIN_REAUTH_REQUIRED | 展示所需条件；不循环请求；管理roleVersion/epoch变化先清私有界面 |
| 404 | NOT_FOUND | 不区分私有对象不存在或无权读取 |
| 409 | VERSION_CONFLICT / DATASET_CHANGED / IDEMPOTENCY_CONFLICT / EVIDENCE_CHANGED / OPERATION_INTENT_STALE / OPERATION_INTENT_USED | 刷新版本或重新预览；旧学生模型解释作废，不自动付费重试 |
| 410 | EVIDENCE_RECEIPT_EXPIRED / OPERATION_INTENT_EXPIRED | 票据/intent过期，重新取证或预览；不自动重执行高影响操作 |
| 413 | PAYLOAD_TOO_LARGE | 缩小输入 |
| 422 | VALIDATION_FAILED / CURSOR_INVALID | 展示字段级代码，不回显危险输入 |
| 428 | OPERATION_INTENT_REQUIRED / CONFIRMATION_REQUIRED | 仅相应高影响动作进入预览/确认，不给全部普通JSON命令加审批 |
| 429 | RATE_LIMITED / PLATFORM_AI_BUDGET_EXCEEDED | 遵循Retry-After；平台分析预算错误仅用于其管理准入 |
| 503 | UPSTREAM_UNAVAILABLE / SYSTEM_BUSY / PLATFORM_AI_UNAVAILABLE | 按受影响能力降级，不阻塞无关查询 |
| 500 | INTERNAL | 展示 request ID，记录脱敏追踪 |

服务器不把所有内部 5xx 伪装成 503，不暴露 SQL、RLS 策略、密钥、供应商响应正文或堆栈。重试仅在原操作有幂等保证时执行；浏览器取消请求不代表服务端事务被回滚。

## 6. AI 数据协议与平台派生内容

本站不提供学生 `/ai/queries`、`/ai/jobs`、模型relay、学生结果持久化或SSE。供应商流协议由浏览器adapter处理，不套用本站错误信封。前端Key只发送至所选注册表目标；本站接口若收到apiKey/providerKey/authorizationConfig等字段一律422，入口与APM不能记录该请求正文，防误传后再被日志保存。

`search` 接收版本化DSL（课程名/ID二选一且最多5个、学期、校区、排除时段最多20、评分条件、白名单排序、limit≤20），学校由服务器上下文确定。响应返回规范条件、确定候选和歧义/缺失信息，无原始模型文本。所有SQL有界且参数化，见 [12](12-student-byok-ai.md)。

`evidence` 仅接受获准公开候选ID、scope及允许证据类型；服务器重查当前资格和主库公开状态。初始上限20个候选、40条评价节选，总响应UTF-8≤32KiB，单条节选有长度限制；不给无限分页抓取上下文的特权。返回签名`evidenceReceipt`，包含或绑定完整证据ID/修订/generation/数据版本摘要、主体、有效期（建议2分钟）。票据不得发给供应商，只发公开证据内容；签名算法/密钥与Auth令牌隔离，不能作为登录凭证。

`validate` 只接受原票据及受限引用ID/结构化数值，不接收Key、原始提问、整段解释或对话。先核验当前会话epoch、本人、学生资格/封禁、签名/期限，再向主库检查整个取证集（不只最终引用）当前状态/版本。变更返回409，过期410，权限失效401/403；失败不返回私有对象差异。成功仅表示来源和结构化字段可核对，不能认证学生模型自由文本真假。

平台教师总结由独立worker生成并经受控强条件提交，公开GET不触发付费生成。响应state区分ready、generating、insufficient、unavailable或invalidated；非ready不能夹带旧句子。ready必须完整manifest/teacherSummaryEpoch/dataVersion主库校验通过，包含范围、有效/使用样本量、来源和局限；HTTP no-store。审核辅助置信度保持私有，平台重新分析申请仅管理入口允许，固定kind/目标/版本并受预算去重；详细表与状态见 [13](13-platform-ai-analysis.md)。

## 7. HTTP 缓存契约

Q 路由建议入口值 `max-age=0, s-maxage=30, stale-while-revalidate=30`，具体对象 TTL 由 [06](06-capacity-and-performance.md) 统一规定；静态 hash 资源可 immutable。R/P 路由一律 `Cache-Control: no-store`，不由 Service Worker 或前端持久缓存保存正文。ETag 对应规范化表示和数据版本，304 不能绕过需要的正文可见性检查。

缓存白名单 route、query、响应 schema 与部署规则共同版本化；未知 query 参数、错误响应、Set-Cookie 响应不得共享缓存。拒绝客户端控制 cache key 前缀、host 转发头、内部 cache 状态和 purge tag。公共接口不因 Cookie、Authorization、语言或登录态偷偷变化；需要新变体时显式纳入白名单 key 和契约。

## 8. 管理操作预览、命令作业与密管例外

### 8.1 注册表与高影响 intent

每个管理功能必须在同站UI、路由、输入/输出schema、所属管理组/capability/scope、风险级、执行port与审计之间有可查映射。registry只描述固定功能/动作，不注册自由脚本/SQL/工具/command。前端按当前权限显示，服务端逐次鉴权。只有system_admin和content_admin两个管理组，组内cap仅缩减，不跨组增授或自动全权；另三组无管理能力，矩阵见[14](14-admin-workspace-and-security.md)。

| 方法 / 路径 | 协议行为 | 必须检查 |
| --- | --- | --- |
| POST /admin/operation-intents | 校验固定操作及有界参数，生成差异/影响预览、digest和短期intent，201 | A+CSRF/幂等、动作/授予scope、目标版本、操作策略；不是执行，也不先产生外部副作用 |
| GET /admin/operation-intents/:intentId | 读取本人/获准复核人的预览与确认状态 | A、目的/范围、当前版本，不得看他人跨scope intent |
| POST /admin/operation-intents/:intentId/approvals | 仅策略要求时，由不同合格主体确认/拒绝同一digest | A+专项确认capability/CSRF/幂等、非发起人、当前scope/目标/有效期；不向所有动作强加双人审批 |
| POST /admin/commands | 对已确认的短期intent原子复验/消费并创建命令作业，202 | A+CSRF/幂等、当前capability/scope、目标版本/digest、必要近5分钟强认证与第二人条件 |
| GET /admin/command-jobs；GET /admin/command-jobs/:commandJobId | 分页列表、受控进度/结果与允许动作 | A+相应查看capability/对象scope；不触发执行/重试/修复 |
| POST /admin/command-jobs/:commandJobId/cancel | 对当前可取消阶段记录取消意图 | A+当前取消capability/CSRF/幂等/expectedVersion；外部已发生副作用不保证撤回 |
| POST /admin/command-jobs/:commandJobId/reauthorize | 在需要重新认证的固定阶段恢复已确认任务授权 | A+新鲜强认证、当前动作/scope、expectedVersion；按风险策略重预览/绑定新intent，不改原参数或重放已完成步骤 |

`operation-intents` 的输入只接受注册表枚举 `operationId`、规范目标、scope 提示、目标版本和该操作专有参数。scope 提示必须与数据库当前授权相交，不能由客户端扩大。服务器绑定发起人、应用/管理会话、roleVersion/sessionEpoch、规范参数摘要、预览目标版本、策略版本和 expiresAt，写入 `private.operation_intents`；原始密钥永远不进入其中。

`POST /admin/commands` 示例只用于协议说明：

```json
{
  "intentId": "server-issued-intent",
  "expectedIntentVersion": 2,
  "digest": "server-bound-preview-digest",
  "confirmation": { "acknowledged": true }
}
```

提交不再接收操作字符串、自由参数、actor/role/scope替代值或秘密，从绑定intent装配。服务器同事务复验当前权限、新鲜认证、目标/预览版本、期限及必要第二人条件，原子消费intent、建private.admin_command_jobs并写审计/幂等结果。同key返回原job前仍重验权限，同intent不重复执行。202响应为 `{ data: { commandJobId, executionState, statusUrl }, ... }`，statusUrl为固定站内路由，executionState与AdminCommandJobDTO统一。

组权限授予、获准平台行为case、真正删除个人信息、导入发布、关键registry/预算/配置切换和备份恢复发布按[14](14-admin-workspace-and-security.md)风险项进入该流程。校园真实身份揭示、查重查询或管理员首次授学生资格均为禁止能力，不能用审批解锁。普通审核/受限编辑可走第2.2节直接JSON，不给全部GET/PATCH或合格总结增加审批。

授权命令再次检查system_admin、可授组内capability/学校scope、不自升权和最后有效system_admin保护；组名不授任意权限。平台行为case只返回批准目的/目标/期限内的平台事实，查看留审计，无校园身份。备份/发布仅使用登记恢复点/制品/环境ID，不接受任意URL/路径/命令文本。

### 8.2 作业执行与撤销

admin-api 只持受限业务连接和命令调度 port；安全、运维、密管执行分别交 `apps/command-runner` 的 `security/ops/secret-write` 模式，凭据与队列按能力分离。数据库 owner、Supabase 管理/基础设施令牌或执行秘密不进入浏览器及普通 API，runner 也不提供任意 SQL/shell 解释器。

作业持久化固定动作/参数摘要/scope/目标与批准主体，不携Cookie、不永久信旧能力。领取、关键副作用和授权提交前重查发起人当前账号/能力/scope/roleVersion/sessionEpoch、撤销/期限/fence；需要第二人的还重验复核者当前capability/scope及批准有效性。撤权阻止未执行步骤，旧幂等不续权；认证/复核过期进入needs_reauthorization，同站重新认证/必要预览后按版本恢复，不改成系统任务。独立记录已发生副作用/费用/审计与取消核对仍允许，不以人的撤权删除事实或冻结对账。

建议受控状态包含 `queued/running/needs_reauthorization/cancel_requested/cancelled/succeeded/failed/uncertain`，完整状态转换由固定操作 schema 定义。取消尽力执行，外部系统可能已产生不可逆影响；未知上游状态记 `uncertain` 并对账，不透明重发，不以任务租约过期证明外部动作未发生。撤权后仍须记录已发生的事实和审计，不执行新的特权步骤，不伪造为全部回滚。GET 仅返回脱敏阶段、结果摘要、当前可操作项和受控错误，无原始 runner 输出；所有管理列表/结果 no-store 并按当前查看权限重新授权。

### 8.3 平台秘密替换是专门的 write-only 协议

日常管理页面可配置平台秘密，但只能读取 `keyRef`、版本、configured/掩码状态和轮换时间，不能 GET 原文。学生 BYOK Key 始终不能上送该路径；此处只处理平台已登记且当前管理员获准替换的密管槽位，不提供任意个人 Key 托管或模型代理。

| 方法 / 路径 | 行为 | 秘密边界 |
| --- | --- | --- |
| POST /admin/secrets/:keyRef/write-tickets | 为固定keyRef/expectedSecretVersion/供应商origin签发一次性短期写票据 | A+秘密写capability+当前scope+管理CSRF+近5分钟强认证；票据绑定actor/adminSession/目标/版本/到期时间 |
| POST /admin/secrets/:keyRef/replace | 专用no-log write-only handler验证写票据后，把secretValue直接写入密管stagedVersion | 不经普通admin handler解析/排队，不进通用intent/job/幂等body摘要；一次性writeNonce防重放，成功只返回keyRef/stagedVersion/状态 |

专用写入口有独立窄 schema、body 大小/时限、TLS、Origin/CSRF、票据/capability 复验和日志禁采集，入口/APM/WAF/runner 也不得采集请求体、秘密 header、错误对象或原始响应。票据消费状态只存最小元数据，不存 secretValue 或其 body hash；重复票据返回409 `SECRET_WRITE_NONCE_USED` 并提供不含原值的状态核对，不能声称比较了秘密原文是否相同。响应不回显原文或可重构的固定前后缀。

新值只在管理文档短期内存、专用transport和密管中出现，成功/离页清理引用，不承诺物理擦除。写结果未知不自动重发，先查状态。通用预览/命令只引用stagedVersion、keyRef、expectedSecretVersion与scope，确认激活/丢弃；原文/值hash不进任务/审计/队列/普通幂等账本。读写权限分离，写成功不让浏览器读取旧值；普通资源仍使用expectedVersion。

### 8.4 管理契约验收

验证非管理员无workspace/registry/DTO能力；管理直链/刷新有严格CSP，MFA可启动但未升权无业务数据，双Cookie/CSRF分离/绑定/撤销有效。五组分类、管理组互斥、组内cap上限、管理员无grant不能使用学生API均需负测。所有动作验证当前scope/对象/状态，旧intent/幂等/作业不续权，防篡改重放/越校、自升权与并发移除最后system_admin。

所有日常功能必须有同站页面与协议映射、分页/失败重试与作业反馈；低影响直接命令可正常使用，高影响只按注册策略增加确认/新鲜认证/必要第二人。验收包含三模式runner受限执行、恢复/回滚演练、写票据重放、原值零GET/零日志/零任务持久化，以及学生BYOK Key依旧只到学生选择的供应商；不能用“隐藏了按钮”“bundle不公开”“已换Cookie名字”替代权限与XSS边界测试。

## 9. 匿名认证的专用领取协议

公开API不接收tag或verified布尔值。verifier只能在可信proof成功后经工作负载认证提交短期内部断言；绑定会话challenge、受信scope/验证策略、keyringGeneration与全部历史候选tag，不经浏览器/普通BFF。受控DB函数同事务验证当前keyring/会话/账号/challenge、查历史标签、插当前UNIQUE tag、建唯一grant并消费challenge；已有active资格返回已有状态且不消费第二身份，revoked/历史资格走原账号平台补救。proof/KMS调用在事务外，候选参数与错误detail不打印。

认证不使用通用含body摘要的幂等表、trace或job。提交前失败全部回滚；提交后响应丢失只查本人grant，不能在新账号重发。重复或失败返回统一受控`STUDENT_CLAIM_UNAVAILABLE`及平台恢复指引，不暴露哪个tag/校园账号已领取或原平台账号。challenge过期/会话失效拒绝；KMS/历史keyring/查重恢复水位不可证时503 `STUDENT_VERIFICATION_UNAVAILABLE`并关闭新认证，普通查询独立。

全部认证入口/callback/响应no-store且禁URL query/body/header、异常/trace/APM/WAF采样和临时落盘；认证原文/密文不进Auth.identities、DB、Redis、对象/队列或备份，HMAC标签也不进管理/日志/AI/导出。grant仅证明首次验证时学生，无续证/换绑/校园身份恢复；删号/撤销不清spent tag，历史key轮换不重置名额。完整保证范围、恢复与侧信道限制见[15](15-anonymous-student-verification.md)。
