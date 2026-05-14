# db

数据库连接、migration runner 和事务边界。生产路径使用 Kysely + mysql2 连接
MySQL；DB repository 集成测试必须通过 `EXPORT_PLATFORM_TEST_DATABASE_URL`
连接真实数据库运行。
