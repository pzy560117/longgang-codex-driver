# query tests

查询执行器的本机或 Docker MySQL 集成测试目录。

`npm run test:query` 必须连接 `EXPORT_PLATFORM_TEST_DATABASE_URL` 指向的本机或 Docker MySQL。
未设置时测试必须明确输出 `BLOCKED - 需要人工介入`，不得改用 mock、内存库或 planned 占位作为验收证据。

当前目录先放 RED 期望测试，覆盖参数 schema、模板绑定、字段映射、脱敏、数据范围、游标分页和批次 checkpoint。
