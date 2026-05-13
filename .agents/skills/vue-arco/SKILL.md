---
name: vue-arco
description: Vue 3 + Arco Design 开发指南
---

# Vue 3 + Arco Design 开发指南

## 项目结构

```
WHartTest_Vue/src/
├── api/              # API 请求封装
├── components/       # 通用组件
├── composables/      # 组合式函数
├── config/           # 配置文件
├── features/         # 功能模块
├── layouts/          # 布局组件
├── router/           # 路由配置
├── services/         # 业务服务
├── store/            # Pinia Store
├── utils/            # 工具函数
└── views/            # 页面视图
```

## 开发规范

### 组件定义 (Composition API)
```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'

interface Props {
  title: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  (e: 'submit', data: any): void
}>()

const data = ref<string[]>([])

onMounted(async () => {
  // 初始化逻辑
})
</script>

<template>
  <a-card :title="title" :loading="loading">
    <slot />
  </a-card>
</template>
```

### Pinia Store
```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMyStore = defineStore('my', () => {
  const items = ref<Item[]>([])
  const loading = ref(false)

  const itemCount = computed(() => items.value.length)

  async function fetchItems() {
    loading.value = true
    try {
      items.value = await api.getItems()
    } finally {
      loading.value = false
    }
  }

  return { items, loading, itemCount, fetchItems }
})
```

### API 封装
```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000
})

export const myApi = {
  getList: () => api.get('/api/items/'),
  create: (data: CreateDto) => api.post('/api/items/', data),
  update: (id: number, data: UpdateDto) => api.patch(`/api/items/${id}/`, data),
  delete: (id: number) => api.delete(`/api/items/${id}/`)
}
```

## Arco Design 常用组件

- `a-table` - 数据表格
- `a-form` / `a-form-item` - 表单
- `a-modal` - 弹窗
- `a-button` - 按钮
- `a-input` / `a-textarea` - 输入框
- `a-select` - 选择器
- `a-message` - 消息提示
- `a-notification` - 通知

## 开发命令

```bash
cd WHartTest_Vue
npm run dev      # 开发服务器
npm run build    # 生产构建
```

