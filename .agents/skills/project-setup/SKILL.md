---
name: project-setup
description: 项目初始化指南
---

# 项目初始化指南

## 触发条件
新建项目、脚手架、目录结构、项目配置

## 前端项目 (React + TypeScript)

### Vite 创建
```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
```

### 推荐目录结构
```
src/
├── components/       # 通用组件
│   └── ui/          # 基础 UI 组件
├── features/        # 功能模块
│   └── auth/
│       ├── components/
│       ├── hooks/
│       ├── api.ts
│       └── types.ts
├── hooks/           # 通用 hooks
├── lib/             # 工具函数
├── services/        # API 服务
├── stores/          # 状态管理
├── types/           # 全局类型
├── App.tsx
└── main.tsx
```

### 基础依赖
```bash
# 路由
npm install react-router-dom

# 状态管理
npm install zustand

# HTTP 请求
npm install axios

# UI 组件库 (选一)
npm install antd
npm install @mui/material @emotion/react @emotion/styled

# 开发工具
npm install -D @types/node prettier eslint-config-prettier
```

## 后端项目 (Node.js + TypeScript)

### 初始化
```bash
mkdir my-api && cd my-api
npm init -y
npm install typescript ts-node @types/node -D
npx tsc --init
```

### 推荐目录结构
```
src/
├── controllers/     # 请求处理
├── services/        # 业务逻辑
├── models/          # 数据模型
├── middlewares/     # 中间件
├── routes/          # 路由定义
├── utils/           # 工具函数
├── types/           # 类型定义
├── config/          # 配置文件
└── index.ts         # 入口文件
```

### Express 基础依赖
```bash
npm install express cors helmet
npm install -D @types/express @types/cors
```

## 配置文件模板

### tsconfig.json (前端)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

### .prettierrc
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### .eslintrc.cjs
```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': 'warn',
  },
};
```

## 最佳实践
- 使用路径别名 `@/` 简化导入
- 配置 EditorConfig 统一编辑器设置
- 添加 .nvmrc 锁定 Node 版本
- 使用 husky + lint-staged 做提交检查

