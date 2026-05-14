# db tests

DB migration、repository、事务和锁行为测试目录。

`npm run test:db` 必须连接真实 MySQL。设置 `EXPORT_PLATFORM_TEST_DATABASE_URL`
后运行；未设置时测试会明确输出 `BLOCKED - 需要人工介入`，不得改用内存库替代。
