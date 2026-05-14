# file tests

文件渲染、发布、下载保护、过期清理和对象存储失败态测试目录。

`npm run test:file` 必须连接 `EXPORT_PLATFORM_TEST_DATABASE_URL` 指向的真实 MySQL。
本目录默认通过注入的“生产等价 object-storage adapter”验证 temp object、checksum、publish 和 cleanup 行为；这只能作为 adapter 级集成证据，不能宣称 live OSS/S3 已验证。
若环境驱动对象存储配置缺失，测试必须明确输出 `BLOCKED - 需要人工介入`，不得用 mock 或内存对象存储冒充 release 证据。
