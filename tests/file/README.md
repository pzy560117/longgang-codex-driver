# file tests

文件渲染、发布、下载保护、过期清理和对象存储失败态测试目录。

`npm run test:file` 必须连接 `EXPORT_PLATFORM_TEST_DATABASE_URL` 指向的真实 MySQL。
本目录保留两类对象存储证据：
- 注入的“生产等价 object-storage adapter”，用于覆盖 checksum、cleanup 和失败态等 adapter 级集成场景。
- 本地 HTTP server 驱动的 env-backed adapter，用 `EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT` + bucket 验证 `createObjectStorageFromEnv()` 的 put/read/publish/download URL 流程。

这两类证据都不能宣称 live OSS/S3 已验证；release gate 只能证明生产 adapter 的 HTTP 协议路径已打通。
若环境驱动对象存储配置缺失，`createObjectStorageFromEnv()` 仍必须明确输出 `BLOCKED - 需要人工介入`，不得用 mock 或内存对象存储冒充 release 证据。
