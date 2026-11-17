# Curator 隐私政策 / Privacy Policy

更新日期 / Last updated: 2026-11-17

本政策适用于 Curator Chrome 扩展及其弹窗、侧栏、设置页、书签新标签页和网页存档功能。项目由 GitHub 用户 **sy0u1ti** 维护。

This policy applies to the Curator Chrome extension, including its popup, side panel, settings, bookmark New Tab page, and page archive feature. The project is maintained by GitHub user **sy0u1ti**.

## 本地数据 / Local data

Curator 不提供开发者托管的账号或后端，不加入遥测、广告或使用情况分析。普通书签搜索、浏览、编辑和整理在本机执行。原生书签由 Chrome 保存；扩展的设置、标签、摘要、正文索引、忽略规则、检测结果、回收站、恢复点、图标、壁纸和诊断记录保存在浏览器的本地存储、IndexedDB 或本机导出文件中。

Curator has no developer-operated account system or backend and includes no telemetry, advertising, or usage analytics. Ordinary bookmark search, browsing, editing, and organization run locally. Chrome stores native bookmarks. Extension settings, tags, summaries, full-text indexes, ignore rules, link-check results, recycle-bin entries, recovery points, icons, wallpapers, and diagnostic records are stored in browser-local storage, IndexedDB, or files exported to your computer.

## 联网功能 / Network features

联网功能会直接连接相关网站或你选择的服务。服务器会收到建立网络连接所必需的信息，例如 IP 地址和请求元数据；接收方如何处理数据受其政策约束。Curator 开发者不会通过这些功能接收你的书签库、查询、网页内容或登录凭据。

Network features connect directly to the relevant websites or services you choose. Servers receive connection information such as your IP address and request metadata, and their own policies govern their handling of that information. These features do not send your bookmark library, queries, page content, or credentials to the Curator developer.

| 功能 / Feature | 数据与接收方 / Data and recipients |
| --- | --- |
| 书签可用性检测、重定向检查、正文提取和站点图标 / Link checks, redirects, text extraction, and site icons | 访问对应书签网站以获取状态、内容或图标。浏览器缓存优先用于图标。/ Contacts the bookmarked site to retrieve status, content, or icons. Browser-cached icons are preferred. |
| 可选 AI 分析、分类和语义搜索 / Optional AI analysis, classification, and semantic search | 向你配置的 AI 服务发送所需的查询、书签标题及网址、文件夹信息、标签和相关网页内容；请求范围取决于所选功能。可以配置本机服务。/ Sends the queries, bookmark titles and URLs, folder information, tags, and relevant page content needed by the chosen feature to your configured AI service. Local services can be configured. |
| 可选网页内容辅助解析 / Optional remote page parsing | 启用并授权后，Jina Reader（`r.jina.ai`）会收到需要解析的目标网址，并返回网页内容。/ When enabled and authorized, Jina Reader (`r.jina.ai`) receives the target URL and returns the page content. |
| 可选书签或标签页同步 / Optional bookmark or tab sync | 将你选择的文件夹中的书签，或所选普通窗口的标签页标题、网址和分组信息，发送到你配置的 WebDAV、Nextcloud、S3、Git、Linkwarden、Karakeep、Google Drive 或 Dropbox 服务。/ Sends bookmarks from the folder you choose, or titles, URLs, and group information for tabs in the ordinary window you choose, to your configured WebDAV, Nextcloud, S3, Git, Linkwarden, Karakeep, Google Drive, or Dropbox service. |
| Google / Dropbox 登录 / Google or Dropbox sign-in | 向相应服务发送 OAuth 授权及令牌请求。显示名称和刷新令牌保存在扩展本地，用于展示账号和继续已授权的同步。Google Drive 使用 `drive.file`，限于应用创建或用户向应用提供的文件。/ Sends OAuth authorization and token requests to the corresponding provider. Display names and refresh tokens are stored locally to show the connected account and maintain authorized sync. Google Drive uses `drive.file`, limited to files created by or made available to the app. |
| 可选 Nextcloud 书签访问统计 / Optional Nextcloud bookmark visit counts | 仅在启用该选项并授予历史记录权限后，将与已同步书签匹配的访问更新发送到你配置的 Nextcloud Bookmarks 服务。不会上传完整浏览历史。/ Only when enabled and granted the history permission, sends visit updates matching synced bookmarks to your configured Nextcloud Bookmarks service. It does not upload your complete browsing history. |
| 新标签页网页搜索 / New Tab web search | 使用 Chrome Search API 将你提交的搜索词交给 Chrome 当前默认搜索服务。Curator 不替换默认搜索引擎，也不使用搜索联盟链接。/ Uses the Chrome Search API to send submitted queries through Chrome's current default search provider. Curator does not replace your default search engine or use search affiliate links. |
| 远程壁纸与媒体 / Remote wallpaper and media | 访问你填写的媒体网址。已有精选壁纸配置或图库相关功能可能访问相应公开图片或资料来源。不会向来源发送书签库。/ Fetches media URLs you provide. Existing featured-wallpaper configurations or gallery functions may contact the corresponding public image or metadata sources. Your bookmark library is not sent to them. |
| 模型资料更新 / Model catalog updates | 按你启用的设置从 `models.dev` 下载公开模型资料，不发送 AI 密钥、书签或搜索词。/ Downloads public model information from `models.dev` according to your enabled settings, without sending AI keys, bookmarks, or queries. |
| MHTML 网页存档 / MHTML page archives | 浏览器在本机保存当前网页已经加载的内容。Curator 不将存档上传到开发者服务器。原网页加载期间仍会与原站点通信。/ The browser saves the selected page's already-loaded content locally. Curator does not upload archives to a developer server. The original page still communicates with its site while loading. |

已启用的自动分析、自动同步和模型资料更新可以在后台运行。你可以关闭相应选项或撤销站点授权。

Enabled automatic analysis, sync, and model updates may run in the background. You can turn them off or revoke site access.

## 凭据、权限和控制 / Credentials, permissions, and controls

AI API Key、同步密码、访问令牌和自定义授权信息保存在扩展本地，并仅发送到你配置的相应服务。同步配置导出文件可能包含密码或令牌，应作为敏感文件保管；普通 JSON 备份不包含 AI API Key 或授权请求头。诊断日志可能包含书签标题、网址或服务地址，分享前请检查。

AI API keys, sync passwords, access tokens, and custom authorization settings are stored locally and sent only to their configured services. Sync-configuration exports may contain passwords or tokens and should be treated as sensitive files. Ordinary JSON backups omit AI API keys and authorization headers. Diagnostic logs may include bookmark titles, URLs, or service addresses; inspect them before sharing.

浏览器书签权限用于核心管理功能；网页搜索权限用于遵循 Chrome 默认搜索引擎。站点访问、网页存档、标签页与分组同步、OAuth 登录以及访问统计所需的权限按功能申请。拒绝可选权限会影响相应功能，普通本地书签功能仍可使用。

Bookmark access supports the core management features; search access lets web search respect Chrome's default provider. Website access, page capture, tab and group sync, OAuth sign-in, and visit statistics request the permissions needed for their features. Declining optional access disables the corresponding feature while ordinary local bookmark functions remain available.

你可以在扩展设置中关闭自动任务、删除同步配置、清理附加数据或导出备份，也可以在 Chrome 扩展管理中撤销权限或卸载扩展。卸载会移除扩展的本地存储，但不会撤销已经修改的原生书签，也不会删除你另行导出的文件或同步到外部服务的数据。外部服务中的数据、授权和备份需要在相应服务中管理。

You can disable automatic tasks, remove sync configurations, clear additional local data, or export a backup in extension settings. You can also revoke permissions or uninstall Curator in Chrome. Uninstalling removes extension-local storage, but does not undo edits to native bookmarks or delete separately exported files or data synced to external services. Manage external data, authorization grants, and backups in the relevant service.

## 数据用途 / Data use

Curator 仅为本政策和产品界面说明的书签管理功能处理数据。我们不出售用户数据，不将数据用于广告、信用评估或借贷，不将其用于与扩展单一用途无关的目的，也不建立用户行为档案。

Curator processes data only for the bookmark-management features described in this policy and the product interface. We do not sell user data, use it for advertising, creditworthiness, or lending, repurpose it for unrelated functions, or build behavioral profiles.

Curator 对用户数据的使用和转移遵循 [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)，包括 Limited Use 要求。

Curator's use and transfer of user data adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use), including its Limited Use requirements.

Curator 对通过 Google API 获得的信息的使用和转移遵循 [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)，包括 Limited Use 要求。

Curator's use and transfer of information received from Google APIs adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including its Limited Use requirements.

## 联系与变更 / Contact and changes

有关隐私或本政策的问题，请通过 [GitHub Issues](https://github.com/sy0u1ti/curator-bookmarks/issues) 联系维护者。公开问题中请勿提交私有书签库、网页存档、密码或令牌。

For privacy questions, contact the maintainer through [GitHub Issues](https://github.com/sy0u1ti/curator-bookmarks/issues). Do not post private bookmark libraries, page archives, passwords, or tokens in public issues.

功能或数据处理方式变更时会更新本政策，并修改上述更新日期。

This policy will be updated when features or data practices change, with the revision date shown above.
