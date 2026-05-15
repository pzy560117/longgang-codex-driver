# sample tests

采购订单样板、边界数据和压测证据测试目录。

`npm run test:sample` 必须连接 `EXPORT_PLATFORM_TEST_DATABASE_URL` 指向的本机或 Docker MySQL。
样板文件发布在本目录内使用注入的“生产等价 object-storage adapter”完成集成验证，用于证明 registry/query/file/audit/download 链路可执行；这不是 live OSS/S3 release 证据。
若要声明真实对象存储已验证，必须改用环境驱动的 `createObjectStorageFromEnv()` 并在依赖不可达时明确输出 `BLOCKED - 需要人工介入`。
