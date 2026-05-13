---
name: django-drf
description: Django + DRF 开发指南
---

# Django + DRF 开发指南

## 项目结构

```
WHartTest_Django/
├── wharttest_django/     # 项目配置
│   ├── settings.py       # Django 设置
│   ├── urls.py           # 根路由
│   └── celery.py         # Celery 配置
├── accounts/             # 用户认证
├── api_keys/             # API Key 管理
├── knowledge/            # 知识库模块
├── langgraph_integration/# LLM 集成
├── mcp_tools/            # MCP 工具
├── orchestrator_integration/ # Agent 编排
├── projects/             # 项目管理
├── prompts/              # 提示词管理
├── requirements/         # 需求管理
└── testcases/            # 测试用例
```

## 开发规范

### Model 定义
```python
from django.db import models

class MyModel(models.Model):
    """模型说明"""
    name = models.CharField(max_length=100, verbose_name="名称")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "我的模型"
        ordering = ['-created_at']
```

### Serializer 定义
```python
from rest_framework import serializers

class MyModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = MyModel
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']
```

### ViewSet 定义
```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

class MyModelViewSet(viewsets.ModelViewSet):
    """ViewSet 说明"""
    queryset = MyModel.objects.all()
    serializer_class = MyModelSerializer
    
    @action(detail=True, methods=['post'])
    def custom_action(self, request, pk=None):
        """自定义操作"""
        instance = self.get_object()
        return Response({'status': 'ok'})
```

### URL 配置
```python
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'mymodels', MyModelViewSet, basename='mymodel')
urlpatterns = router.urls
```

## 测试命令

```bash
# 在 Docker 容器内执行
docker-compose exec backend python manage.py test requirements.tests
docker-compose exec backend python manage.py test --keepdb
```

## 数据库迁移

```bash
docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate
```

