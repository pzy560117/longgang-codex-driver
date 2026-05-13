---
name: state-management
description: 状态管理指南
---

# 状态管理指南

## 触发条件
Redux、Zustand、状态管理、全局状态、store

## 技术选型

| 方案 | 适用场景 | 复杂度 |
|------|---------|--------|
| React Context | 简单共享状态，低频更新 | 低 |
| Zustand | 中小型项目，简洁 API | 低 |
| Jotai | 原子化状态，细粒度更新 | 中 |
| Redux Toolkit | 大型项目，复杂状态逻辑 | 中高 |

## Zustand (推荐)

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UserState {
  user: User | null;
  isLoading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

/**
 * 用户状态 Store
 */
export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isLoading: false,
        
        login: async (credentials) => {
          set({ isLoading: true });
          try {
            const user = await authApi.login(credentials);
            set({ user, isLoading: false });
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        },
        
        logout: () => {
          set({ user: null });
        },
      }),
      { name: 'user-storage' }
    )
  )
);

// 组件中使用
function Profile() {
  const { user, logout } = useUserStore();
  // 选择性订阅，避免不必要渲染
  const isLoading = useUserStore(state => state.isLoading);
}
```

## Redux Toolkit

```typescript
import { createSlice, createAsyncThunk, configureStore } from '@reduxjs/toolkit';

/**
 * 异步 Action
 */
export const fetchUsers = createAsyncThunk(
  'users/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return await userApi.getAll();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Slice 定义
 */
const usersSlice = createSlice({
  name: 'users',
  initialState: {
    list: [] as User[],
    status: 'idle' as 'idle' | 'loading' | 'succeeded' | 'failed',
    error: null as string | null,
  },
  reducers: {
    userAdded: (state, action) => {
      state.list.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const store = configureStore({
  reducer: {
    users: usersSlice.reducer,
  },
});
```

## React Context (简单场景)

```typescript
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

## 最佳实践
- 按功能模块拆分 store
- 异步操作统一处理 loading/error 状态
- 使用选择器避免不必要的重渲染
- 敏感数据不要持久化到 localStorage

