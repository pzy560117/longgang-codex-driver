# scheduler

调度、DB 抢锁、租约续租和接管边界。生产实现必须以数据库时间判断 `lockExpireAt`。
