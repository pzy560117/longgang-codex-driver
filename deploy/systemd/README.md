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

示例安装命令：

```bash
sudo install -d -o root -g root /etc/export-platform
sudo install -d -o export-platform -g export-platform /opt/export-platform-service
sudo cp deploy/systemd/export-platform-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable export-platform-http export-platform-scheduler export-platform-cleanup
sudo systemctl start export-platform-http export-platform-scheduler export-platform-cleanup
sudo systemctl status export-platform-http export-platform-scheduler export-platform-cleanup
```

启动前必须先完成：

1. `npm ci`
2. `npm run typecheck`
3. `npm run arch:check`
4. `node --import tsx --test tests/config-env.test.mjs`
5. `npm run test:contract`
6. `npm run db:migrate -- list`
7. `npm run db:migrate`
