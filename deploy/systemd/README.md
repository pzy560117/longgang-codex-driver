# systemd 三进程模板

这些模板对应生产部署教程中的三个运行入口：

- `export-platform-http.service` -> `npm run start`
- `export-platform-scheduler.service` -> `npm run worker:scheduler`
- `export-platform-cleanup.service` -> `npm run job:cleanup`

使用前按目标主机调整：

- `WorkingDirectory`
- `EnvironmentFile`
- `ExecStart` 中的 `npm` 绝对路径
- `User` / `Group`

环境变量文件必须由部署平台或 secret manager 管理，不要把真实 secret 提交到仓库。
