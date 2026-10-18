# huoshui3.0 参考评估与沿用边界

日期：2026-10-18。本文依据本地 `E:/workspace/SoClear/huoshui3.0` 源码、SQL 和 `whiteboard` 编写。SoClear 的范围已经确认为**教师评分与课程查询**。

v0.4更新：保留旧源码审计；新项目AI分为[学生浏览器BYOK](12-student-byok-ai.md)和[平台分析](13-platform-ai-analysis.md)，积分取消，管理能力统一接入同站[/admin工作区](14-admin-workspace-and-security.md)。权限固定五组，学校认证原文零持久化，采用无平台账号关联列的HMAC查重与独立学生grant，见[15](15-anonymous-student-verification.md)。旧登录/认证、身份数据和管理角色仅作历史参考，不自动进入新方案。

本文未连接原项目数据库、未读取密钥、未验证线上部署。下面的数据库权限说明指本地 SQL 声明的预期结果，不能当作线上权限审计结果。SoClear 是独立新项目，参考目录保持只读，不把原项目账户、用户评价或个人信息自动迁入新库。

下文 `huoshui3.0/路径:行号` 是相邻本地参考项目的源码定位。参考源码不随本仓库发布，这些定位作为评估依据保留。

## 1. 如何理解白板

| 参考材料 | 可以证明什么 | 不能据此推定什么 |
| --- | --- | --- |
| `huoshui3.0/whiteboard/README.md:9` | 同时存在现状与目标两套画布 | 目标节点已经在代码中实现 |
| `huoshui3.0/whiteboard/TARGET-SPEC.md:8` | 文件明确声明目标态，要求前后端隔离、规则下沉和后端分域 | 现有代码已经满足这些约束 |
| `huoshui3.0/whiteboard/review-target.md:9` | 画布规范、引用一致性等检查通过；包含尚不存在的规划路径 | 生产安全、容量、性能或故障恢复已经通过验收 |
| `huoshui3.0/whiteboard/review.md:221` | 对部分源码断言做过人工抽查 | 覆盖所有数据泄漏路径和运行时行为 |

采用白板中的设计原则，需要在 SoClear 自己的代码、迁移和测试中重新落地。不能复制画布节点或目录名后宣称架构已经完成。

## 2. 已核对的现状与设计影响

### 2.1 前后端存在源码耦合和两条业务数据通道

- `huoshui3.0/src/services/supabaseService.ts:1` 导入浏览器 Supabase 客户端；同文件 `huoshui3.0/src/services/supabaseService.ts:5` 导入缓存 API；`huoshui3.0/src/services/supabaseService.ts:6` 直接导入 `server/timetable.mjs`。
- `huoshui3.0/src/services/supabaseService.ts:200` 起的教师分页逻辑同时包含 API 分支与 Supabase 查询分支；`huoshui3.0/src/services/supabaseService.ts:211` 直接构造表查询。
- `huoshui3.0/whiteboard/TARGET-SPEC.md:13` 已提出取消上述耦合，并将共享内容限制为纯类型与常量。

SoClear 从首个版本就只有浏览器到 BFF 的业务通道。浏览器不导入后端模块、数据库 SDK、数据库行类型和 SQL；后端不导入 Web 应用源码。`packages/contracts` 只放传输类型、错误码和协议常量，不反向导出应用内部类型。运行时校验由各端独立实现并通过契约测试对齐。

### 2.2 旧界面的 AI 筛选是规则原型，独立 AI 服务没有校内检索工具

- `huoshui3.0/src/components/AiAssistantModal.tsx:60` 定义本地 `generateRAGResponse`；`huoshui3.0/src/components/AiAssistantModal.tsx:165` 起按关键词和排序取教师候选；`huoshui3.0/src/components/AiAssistantModal.tsx:191` 使用本地函数拼装回答。这条界面路径不能算作已接入真实模型的 RAG。
- 独立服务的 `huoshui3.0/server/ai/agent.mjs:7` 配置模型客户端，但 `huoshui3.0/server/ai/agent.mjs:17` 明确写着未接入教师评价、课表、学校资料和查询工具。
- `huoshui3.0/whiteboard/fragments-target/be-domain.json:223` 同样注明：接入检索与工具属于新增能力，不能作为既有能力验收。

SoClear 的学生AI需新增：本人浏览器模型解析 → 服务端受限条件校验 → 确定性查询与公开证据 → 本人模型解释 → 主库证据复验。学生Key只发供应商，不经BFF；没有服务端学生模型作业。平台模型则在独立后台处理评价置信度辅助与教师总结。两类模型均无任意SQL/URL/审核权限，评价文本不能变成工具指令。

### 2.3 仅删除前端 SDK，不能关闭绕过 API 的数据库访问

本地 `huoshui3.0/supabase/security.sql:43` 对 `anon`、`authenticated` 授予目录表 SELECT；`huoshui3.0/supabase/security.sql:51` 对 `reviews` 授予表级 SELECT；`huoshui3.0/supabase/security.sql:58` 允许读取 `approved` 行。课表 SQL 的 `huoshui3.0/scripts/timetable/schema.sql:114` 和 `huoshui3.0/scripts/timetable/schema.sql:144` 也包含匿名读取授权。

如果这些授权用于仍对外暴露的 Supabase Data API，调用者可不经 SoClear BFF 访问获准数据；BFF 的限流、字段裁剪和审计不覆盖这条路径。RLS 过滤行，并不会自动把获准行裁剪成公共 DTO。

新项目采用服务端直接 SQL 与最小权限数据库角色。业务表不向浏览器持有的 Supabase 公共身份开放读写；关闭或隔离业务 Data API，并验证 `PUBLIC`、`anon`、`authenticated` 的 schema、表、列、序列和函数权限。API、worker、迁移账户分离，运行时账户不使用表所有者或 `BYPASSRLS` 权限。验收必须包含直接请求 Data API 被拒绝的反向测试。

### 2.4 数据库列、公共展示字段与管理字段必须分开

- `huoshui3.0/supabase/base-schema.sql:65` 起的评价表包含 `user_id`、`reject_reason`、`reviewer_id` 和 `reviewed_at` 等身份或管理字段。
- API 的 `huoshui3.0/server/data.mjs:10` 和 `huoshui3.0/server/data.mjs:27` 已有公共字段白名单与 `approved` 检查，这是值得沿用的防线；但它只保护经过该函数的数据路径。
- 浏览器的 `huoshui3.0/src/services/supabaseService.ts:185` 起仍映射 `userId`、`userEmail`、驳回原因和审核人等字段；`huoshui3.0/src/types.ts:43` 起的 `Review` 将公共与管理用途混在同一类型。这里证明字段扩散风险，不能据此断言本地没有的邮箱列在线上存在。

SoClear分别定义公共/自有/审核评价DTO。公共响应、Redis公共缓存、学生查询AI与教师总结只用公开DTO，禁止数据库整行/SELECT *进入这些出口。平台评价分析另通过专用bridge读取任务绑定的脱敏pending修订，不经公开检索接口，不含作者映射。作者ID、邮箱、管理备注、审核身份不得随公共评价返回；匿名展示不等于系统不可追溯。

### 2.5 管理员判定已有正确基础，不能夸大成任意用户提权

`huoshui3.0/src/services/supabaseService.ts:1079` 的 `checkIsAdmin` 实际调用 `get_my_admin_status`，没有用调用者传入的邮箱或元数据决定身份。数据库的 `huoshui3.0/supabase/security.sql:18` 以 `auth.uid()` 关联账户和管理员表。

同文件 `huoshui3.0/src/services/supabaseService.ts:1096`、`huoshui3.0/src/services/supabaseService.ts:1106`、`huoshui3.0/src/services/supabaseService.ts:1119` 的确包含浏览器直读、直写管理员名单。其数据库策略 `huoshui3.0/supabase/security.sql:74` 起已经要求 `super_admin`，所以准确问题是高权限操作分散在浏览器通道，缺少统一 BFF 业务校验与审计入口；不能把它描述成所有学生都能写管理员表。

新项目权限只由服务端会话身份和数据库授权得出。浏览器的角色显示只用于界面呈现；每次敏感操作重新检查权限并记录审计。旧 SQL 依赖 `auth.uid()`、JWT 请求上下文的函数，不能原样复制到直接 SQL 模式后假定仍可工作；需要在新权限模型下重写或适配并验证事务上下文隔离。

### 2.6 旧缓存有可用的原子发布基础，也有明确的扩容局限

- `huoshui3.0/server/cache.mjs:54` 起先写 staging key，再设置过期时间并 `RENAME`，避免暴露半份快照；`huoshui3.0/server/cache.mjs:42` 检查 `__meta` 完整性标记。这些思路可以沿用。
- `huoshui3.0/server/cache.mjs:22` 的 `tail` 和 `huoshui3.0/server/cache.mjs:23` 的 `flights` 均为进程内状态；`huoshui3.0/server/cache.mjs:30` 串行化操作；它们不能代替多副本之间的去重、锁或全局并发控制。
- `huoshui3.0/server/cache.mjs:35` 在 Redis 失败后关闭缓存；`huoshui3.0/server/cache.mjs:66` 起随后加载数据源并返回 `BYPASS`。高流量时，无上限回源会把缓存故障放大为数据库故障。
- `huoshui3.0/whiteboard/fragments-target/be-data.json:59` 已注明整表快照只适合小型目录，不应用于持续增长的评价与流水。

SoClear 将公共读取与用户写入分开限额，使用按查询规范化后的缓存键、有限刷新并发、过期抖动、可验证的缓存失效和回源预算。缓存失效必须通过事务内 outbox 持久化，不能只靠写接口成功后的进程内通知。Redis 故障时优先使用仍满足内容治理时限的公共旧数据，并限制数据库回源；超过预算时快速降级。评价下架、隐私删除与普通目录更新使用不同的失效时限，不能无限延长旧数据展示。

### 2.7 部署参数是旧环境选择，不是 SoClear 的容量目标

`huoshui3.0/whiteboard/fragments-target/ops.json:34` 规划了 Nginx、systemd 和 Redis ACL；`huoshui3.0/whiteboard/fragments-target/ops.json:88` 描述 AI 并发 2、120 秒超时与心跳。这些数字没有附带满足 SoClear 峰值负载的压测证据。

SoClear 采用无状态 Fastify TypeScript BFF、普通 worker、独立平台AI worker、Supabase PostgreSQL 和 Redis。普通worker负责导入/投影，平台AI按独立预算分析评价/生成总结，学生模型在浏览器直连。连接、队列、超时与拒绝策略分别验证；旧端口、进程数和AI计数器不作为容量证明。

## 3. 本次发现的白板与源码偏差

| 白板表述 | 本地源码证据 | SoClear 的处理 |
| --- | --- | --- |
| `huoshui3.0/whiteboard/fragments-target/ops.json:8` 说现状退出没有等待 `cache.tail` | `huoshui3.0/server/index.mjs:39` 已在 `server.close` 回调中等待 | 将优雅退出当作已有参考，不把“补等待”当作未修缺陷 |
| `huoshui3.0/whiteboard/fragments-target/ops.json:115` 说现状所有 5xx 强制成 503 | `huoshui3.0/server/app.mjs:148` 使用 `error.status || 503`，保留显式状态；统一的是 5xx 文案 | 新系统明确区分内部错误、依赖故障和限流，不照抄错误映射结论 |
| `huoshui3.0/whiteboard/fragments-target/contract.json:8` 把评分键描述成 `reviews.dimensions` JSONB | `huoshui3.0/supabase/base-schema.sql:63` 实际声明六个 NUMERIC 列 | 不用白板推导真实表结构；迁移前检查源库实际 schema 和评分版本 |
| `huoshui3.0/whiteboard/fragments-target/be-gateway.json:33` 将前端 `getSession()` 本身与绕过网关混在风险描述中 | `huoshui3.0/whiteboard/TARGET-BRIEFS.md:52` 又允许前端 Auth 会话适配层 | 区分身份会话与业务 Data API；SoClear 另行决定全部身份交互走 BFF，不能把读取会话本身定性为越权 |

上述偏差不否定白板的隔离原则，但说明所有安全结论和迁移计划都必须回到具体源码、SQL 与运行环境验证。

## 4. 相对旧目标契约的明确调整

| 决策主题 | 旧白板 | SoClear 决策与理由 |
| --- | --- | --- |
| 身份通道 | `huoshui3.0/whiteboard/TARGET-SPEC.md:89` 使用浏览器 Bearer Supabase JWT；保留前端 Auth | 浏览器连同登录、回调和退出都只访问 BFF。采用随机 opaque session ID 的 `Secure`、`HttpOnly` cookie，Supabase token 仅存服务端。这样统一撤销、审计和权限检查；配套 Origin/CSRF 校验、会话轮换及超时，不能只改传输载体 |
| 数据通道 | 前端不直连业务表，但旧授权仍可能允许直接调用 Data API | 服务端直接 SQL、独立最小权限角色，业务表不对公共身份开放。隔离 Data API 与 BFF 授权边界必须同时完成 |
| 分页 | `huoshui3.0/whiteboard/TARGET-SPEC.md:92` 以 page/pageSize 为默认 | 公共增长列表优先使用游标，按稳定排序键与唯一 ID 续页；游标绑定筛选条件、排序和版本，避免深 offset、总数统计及重复翻页的额外成本 |
| 公共缓存 | `huoshui3.0/whiteboard/fragments-target/be-gateway.json:8` 延续全局 `no-store` | 仅显式允许的匿名公共接口可被共享缓存；会话、我的评价、审核、AI 历史均 `private, no-store`。公共 DTO 不混入点赞状态或作者权限，公共请求不设置会话 cookie；禁止仅依赖 URL 键复用用户响应 |
| 域协作 | `huoshui3.0/whiteboard/TARGET-SPEC.md:18` 提议事件或公共仓储 | 域内仓储私有。跨域使用明确公开 port、应用用例编排或事务 outbox；拒绝通过“公共 repository”绕过数据所有权和业务不变量 |
| 服务拆分 | 10 个域、API 与 AI 进程 | 模块化BFF、普通worker和独立平台AI三运行模式；学生模型在浏览器。凭据与资源按职责隔离，业务分域不等于每域一个微服务 |
| 产品范围 | `huoshui3.0/whiteboard/TARGET-SPEC.md:99` 覆盖积分、通知和完整旧功能 | 聚焦教师、课程、教学班、评价治理、学生自带模型与平台分析；积分正式取消，不迁移积分账户/规则/流水，通知另按需求评估 |

## 5. 建议进入 ADR 的结论与验收证据

1. **统一 BFF 与服务端会话**：浏览器不携带数据库凭据和 Supabase token。证据包括产物依赖检查、浏览器网络检查、CSRF 测试、会话撤销和跨账户隔离测试。
2. **直接 SQL 与最小权限角色**：运行时与迁移角色分离，不以 `service_role`、表所有者权限替代授权。证据包括真实数据库角色矩阵、直接 Data API 访问被拒、跨用户及跨域访问反向测试。
3. **contracts 与域所有权**：共享包只包含协议；跨域仓储和 Web/后端源码反向引用由 CI 阻断。证据包括 import 图检查和公开 port 契约测试。
4. **公共读模型与缓存边界**：公开读模型独立于管理表，公共、个人和管理响应缓存完全隔离。证据包括 DTO 字段白名单、双账户访问、缓存键隔离、下架传播时限以及 Redis 故障压测。
5. **事务 outbox 与可重试 worker**：业务提交和待处理事件同事务；事件按至少一次投递设计，消费者去重。证据包括提交后进程崩溃、重复投递、乱序和失败重试测试。
6. **AI权限分层**：学生模型只用公开证据DTO，Key仅浏览器直连；平台分析仅受控读取指定脱敏修订，公开总结只用当前published来源。证据包括Key不回传、CORS无代理、注入/越权、来源失效、平台队列与货币预算测试；无积分账户或扣减。
7. **游标与稳定结果**：游标签名或等效完整性保护，绑定筛选及排序；统计总数按成本单独设计。证据包括相同分数、并发更新、非法游标和跨筛选复用测试。

这些结论是 SoClear 的规划输入，不代表本次已经实现、执行迁移或验证了对应容量。工程落地阶段应以新项目的架构、数据、安全、性能和验收文档为准。
