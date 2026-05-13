---
name: celery-tasks
description: Celery 异步任务开发指南
---

# Celery 异步任务开发指南

## 配置位置

```
WHartTest_Django/
├── wharttest_django/celery.py  # Celery 应用配置
├── requirements/tasks.py        # 需求处理任务
└── testcases/tasks.py           # 测试执行任务
```

## 任务定义

```python
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(bind=True, max_retries=3)
def my_async_task(self, param1, param2):
    """
    异步任务说明
    
    Args:
        param1: 参数1说明
        param2: 参数2说明
    """
    try:
        # 任务逻辑
        result = process_data(param1, param2)
        return result
    except Exception as exc:
        logger.error(f"Task failed: {exc}")
        raise self.retry(exc=exc, countdown=60)
```

## 任务调用

```python
# 异步调用
result = my_async_task.delay(param1, param2)

# 带参数调用
result = my_async_task.apply_async(
    args=[param1, param2],
    countdown=10,  # 延迟10秒执行
    expires=3600   # 1小时后过期
)

# 获取结果
if result.ready():
    data = result.get()
```

## 定时任务 (Beat)

```python
# wharttest_django/celery.py
app.conf.beat_schedule = {
    'cleanup-every-hour': {
        'task': 'myapp.tasks.cleanup_task',
        'schedule': crontab(minute=0),
    },
}
```

## Docker 环境

```bash
# 查看 Celery 日志
docker-compose logs -f backend | grep celery

# 手动触发任务
docker-compose exec backend python -c "
from requirements.tasks import my_task
my_task.delay(1, 2)
"
```

## 监控

```bash
# 查看活跃任务
docker-compose exec backend celery -A wharttest_django inspect active

# 查看注册的任务
docker-compose exec backend celery -A wharttest_django inspect registered
```

