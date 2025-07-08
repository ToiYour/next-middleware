# Next.js Middleware & API System Documentation

## 📋 Tổng quan

Hệ thống middleware và API client được thiết kế để giải quyết các vấn đề phức tạp trong việc xác thực, ủy quyền và proxy API calls trong Next.js. Đây là một kiến trúc modular, scalable và type-safe.

## 🏗️ Kiến trúc tổng thể

```
Request → Token Middleware → Auth Middleware → Role Middleware → Proxy Middleware → Backend API
    ↓           ↓                ↓                ↓                ↓
 Refresh      Verify          Check           Forward          Response
 Token        Token           Role            Request
```

## 🔧 Chi tiết từng Middleware

### 1. Token Middleware (`tokenApiMiddleware`)

#### **Mục đích:**
- Tự động refresh access token khi hết hạn
- Đảm bảo token luôn valid cho các middleware tiếp theo
- Xử lý token lifecycle một cách transparent

#### **Cách hoạt động:**
```typescript
export const tokenApiMiddleware: IMiddleware = {
  matcher: /.*/, // Áp dụng cho mọi request
  excluded: /^$/, // Không loại trừ gì
  
  handle: async (req, res, context) => {
    // 1. Lấy token từ cookie
    const accessToken = req.cookies.get('accessToken')?.value
    const refreshToken = req.cookies.get('refreshToken')?.value
    
    // 2. Kiểm tra token có hết hạn không
    if (accessToken && !isExpired(accessToken)) {
      context.accessToken = accessToken // Lưu vào context
      return res
    }
    
    // 3. Refresh token nếu cần
    if (refreshToken) {
      const newToken = await refreshAccessToken(refreshToken)
      context.accessToken = newToken // Lưu token mới vào context
      res.cookies.set('accessToken', newToken) // Set cookie cho client
    }
    
    return res
  }
}
```

#### **Tại sao cần Token Middleware:**
- **Vấn đề:** Access token có thời gian sống ngắn (15-30 phút), nếu hết hạn sẽ bị 401
- **Giải pháp:** Tự động refresh trước khi request đến backend
- **Lợi ích:** User không bao giờ bị logout đột ngột, UX mượt mà

### 2. Auth Middleware (`authApiMiddleware`)

#### **Mục đích:**
- Verify user đã login chưa
- Redirect đến login page nếu chưa auth
- Bảo vệ các route cần authentication

#### **Cách hoạt động:**
```typescript
export const authApiMiddleware: IMiddleware = {
  matcher: /^\/admin/, // Chỉ áp dụng cho /admin routes
  excluded: /^\/login$/, // Loại trừ login page
  
  handle: async (req, res, context) => {
    // 1. Lấy token từ context (đã được refresh ở middleware trước)
    const accessToken = context.accessToken || req.cookies.get('accessToken')?.value
    
    // 2. Redirect nếu không có token
    if (!accessToken) {
      return NextResponse.redirect('/login')
    }
    
    // 3. Verify token validity
    const payload = parseJWT(accessToken)
    if (payload.exp < now()) {
      return NextResponse.redirect('/login')
    }
    
    // 4. Lưu user info vào context cho middleware tiếp theo
    context.user = payload
    return res
  }
}
```

#### **Tại sao cần Auth Middleware:**
- **Vấn đề:** Cần kiểm tra authentication cho nhiều routes
- **Giải pháp:** Centralized authentication logic
- **Lợi ích:** Code clean, dễ maintain, consistent security

### 3. Role Middleware (`roleMiddleware`)

#### **Mục đích:**
- Kiểm tra user có quyền truy cập route không
- Implement fine-grained authorization
- Bảo vệ admin routes

#### **Cách hoạt động:**
```typescript
export const roleMiddleware: IMiddleware = {
  matcher: /^\/admin\/(users|settings)/, // Chỉ admin routes nhạy cảm
  excluded: /^$/,
  
  handle: async (req, res, context) => {
    // 1. Lấy user info từ context (đã được verify ở auth middleware)
    const user = context.user
    
    // 2. Kiểm tra role
    if (user.role !== 'admin') {
      return NextResponse.redirect('/unauthorized')
    }
    
    // 3. Có thể kiểm tra permissions chi tiết hơn
    if (req.nextUrl.pathname.includes('/users') && !user.permissions.includes('user.manage')) {
      return NextResponse.redirect('/forbidden')
    }
    
    return res
  }
}
```

#### **Tại sao cần Role Middleware:**
- **Vấn đề:** Không phải user nào cũng có quyền truy cập mọi resource
- **Giải pháp:** Role-based access control (RBAC)
- **Lợi ích:** Security tốt hơn, scalable cho enterprise apps

### 4. Proxy Middleware (`proxyApiMiddleware`)

#### **Mục đích:**
- Proxy API calls từ frontend đến backend
- Tự động inject access token vào headers
- Giải quyết CORS issues

#### **Cách hoạt động:**
```typescript
export const proxyApiMiddleware: IMiddleware = {
  matcher: /^\/api\//, // Chỉ áp dụng cho /api routes
  excluded: /^\/api\/(auth|health)$/, // Loại trừ auth routes
  
  handle: async (req, res, context) => {
    // 1. Lấy token từ context (đã fresh từ token middleware)
    const accessToken = context.accessToken || req.cookies.get('accessToken')?.value
    
    // 2. Tạo target URL
    const pathName = req.nextUrl.pathname.replace(/^\/api\//, '')
    const target = new URL(`${process.env.API_URL}/${pathName}`)
    
    // 3. Copy headers và inject token
    const headers = new Headers(req.headers)
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
    
    // 4. Rewrite request đến backend
    return NextResponse.rewrite(target, { headers })
  }
}
```

#### **Tại sao cần Proxy Middleware:**
- **Vấn đề:** Frontend gọi API trực tiếp có nhiều issues:
  - CORS problems
  - Token management phức tạp
  - Security risks (expose API endpoints)
- **Giải pháp:** Proxy qua Next.js middleware
- **Lợi ích:** 
  - Automatic token injection
  - Hide backend URLs
  - Centralized request handling

## 🔄 Context System

### **Context là gì:**
```typescript
interface MiddlewareContext {
  accessToken?: string | null
  refreshToken?: string | null
  user?: any
  [key: string]: any
}
```

### **Tại sao cần Context:**
- **Vấn đề:** Middleware chạy tuần tự nhưng không share data
- **Giải pháp:** Context object được truyền qua các middleware
- **Lợi ích:** Token được refresh ở middleware đầu, middleware sau dùng luôn

### **Flow với Context:**
```
1. Token Middleware: context.accessToken = freshToken
2. Auth Middleware: token = context.accessToken (không phải cookie cũ)
3. Role Middleware: user = context.user
4. Proxy Middleware: token = context.accessToken
```

## 🌐 API Client System

### 1. Client Fetch (`clientFetch`)

#### **Mục đích:**
- Gọi API từ browser (client-side)
- Sử dụng proxy middleware để forward request

#### **Cách hoạt động:**
```typescript
export async function clientFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // 1. Gọi đến /api route (sẽ được proxy middleware xử lý)
  const url = `/api${endpoint}`
  
  // 2. Fetch với default options
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  
  // 3. Handle response
  const data = await response.json()
  if (!response.ok) throw new Error(data.message)
  
  return data
}
```

#### **Tại sao cần clientFetch:**
- **Vấn đề:** Browser không thể gọi trực tiếp backend API (CORS, token)
- **Giải pháp:** Gọi qua Next.js API routes → proxy middleware xử lý
- **Lợi ích:** Transparent API calls, automatic token handling

### 2. Server Fetch (`serverFetch`)

#### **Mục đích:**
- Gọi API từ server-side (SSR, SSG)
- Bypass middleware, gọi trực tiếp backend

#### **Cách hoạt động:**
```typescript
export async function serverFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // 1. Gọi trực tiếp backend API
  const url = `${process.env.API_URL}${endpoint}`
  
  // 2. Lấy token từ server cookies
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value
  
  // 3. Inject token vào headers
  const headers = new Headers(options.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  
  // 4. Fetch với token
  const response = await fetch(url, { ...options, headers })
  return response.json()
}
```

#### **Tại sao cần serverFetch:**
- **Vấn đề:** Server-side rendering cần data từ API
- **Giải pháp:** Gọi trực tiếp từ server với token từ cookies
- **Lợi ích:** Fast SSR, no client-side loading states

## 🔀 Client vs Server Fetch

| Aspect | clientFetch | serverFetch |
|--------|-------------|-------------|
| **Chạy ở đâu** | Browser | Next.js Server |
| **Route** | `/api/users` | `https://api.com/users` |
| **Token source** | Automatic (via proxy) | Server cookies |
| **Middleware** | Qua tất cả middleware | Bypass middleware |
| **CORS** | Không vấn đề | Không vấn đề |
| **Use case** | Client interactions | SSR, SSG |

## 🔧 Axios Integration

### **Tại sao cần Axios:**
- **Vấn đề:** Native fetch thiếu features
- **Giải pháp:** Axios với interceptors, retry logic
- **Lợi ích:** Better error handling, request/response transformation

### **Interceptors:**
```typescript
// Request interceptor
axios.interceptors.request.use(async (config) => {
  // Auto-inject token cho server requests
  if (typeof window === 'undefined') {
    const token = await getServerToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
    }
    return Promise.reject(error)
  }
)
```

## 🎯 React Query Integration

### **Tại sao cần React Query:**
- **Vấn đề:** Manual state management cho API calls
- **Giải pháp:** Automatic caching, background updates, optimistic updates
- **Lợi ích:** Better UX, less boilerplate

### **Custom Hooks:**
```typescript
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => clientAxiosFetch<User[]>('/users'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (user: User) => clientAxiosPost('/users', user),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']) // Auto-refresh list
    }
  })
}
```

## 🔄 Request Flow Examples

### **Client-side Request:**
```
1. Browser: clientFetch('/users')
2. Next.js: /api/users
3. Token Middleware: Refresh token nếu cần
4. Auth Middleware: Verify user logged in
5. Role Middleware: Check permissions
6. Proxy Middleware: Forward to backend với token
7. Backend: Process request
8. Response: Data trả về browser
```

### **Server-side Request:**
```
1. Server: serverFetch('/users')
2. Next.js Server: Direct call to backend
3. Get token from cookies
4. Backend: Process request with token
5. Response: Data for SSR
```

## 🚀 Performance Optimizations

### **1. Middleware Optimizations:**
- **Early returns:** Stop middleware chain khi có redirect
- **Context sharing:** Avoid redundant operations
- **Conditional execution:** Chỉ chạy khi cần thiết

### **2. API Optimizations:**
- **React Query caching:** Reduce API calls
- **Background updates:** Fresh data without loading states
- **Optimistic updates:** Instant UI updates

### **3. Token Management:**
- **Lazy refresh:** Chỉ refresh khi cần
- **Context caching:** Share token across middlewares
- **Secure storage:** httpOnly cookies

## 🛡️ Security Considerations

### **1. Token Security:**
- **httpOnly cookies:** Prevent XSS attacks
- **Secure flag:** HTTPS only in production
- **SameSite:** CSRF protection

### **2. Request Security:**
- **CORS handled:** Via proxy middleware
- **Token injection:** Automatic, không expose
- **Error handling:** Không leak sensitive info

### **3. Route Protection:**
- **Authentication:** Auth middleware
- **Authorization:** Role middleware
- **Input validation:** Backend responsibility

## 📝 Usage Examples

### **Server Component:**
```typescript
// app/users/page.tsx
export default async function UsersPage() {
  const users = await serverFetch<User[]>('/users')
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

### **Client Component:**
```typescript
// components/UserList.tsx
'use client'
export default function UserList() {
  const { data: users, isLoading } = useUsers()
  const createUser = useCreateUser()
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <div>
      <button onClick={() => createUser.mutate({ name: 'John' })}>
        Add User
      </button>
      {users?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

## 🔧 Configuration

### **Environment Variables:**
```bash
# .env.local
API_URL=https://your-backend-api.com
NEXT_PUBLIC_API_URL=https://your-backend-api.com
```

### **Middleware Config:**
```typescript
// middleware.ts
export const config = {
  matcher: [
    '/((?!static|.*\\..*|_next).*)',
  ]
}
```

## 🧪 Testing

### **Middleware Testing:**
```typescript
// __tests__/middleware.test.ts
import { tokenApiMiddleware } from '../middlewares/token.middleware'

describe('Token Middleware', () => {
  it('should refresh expired token', async () => {
    const req = createMockRequest({ accessToken: expiredToken })
    const res = NextResponse.next()
    const context = {}
    
    await tokenApiMiddleware.handle(req, res, context)
    
    expect(context.accessToken).toBe(newToken)
  })
})
```

### **API Testing:**
```typescript
// __tests__/api.test.ts
import { clientFetch } from '../lib/api/client'

describe('API Client', () => {
  it('should fetch users successfully', async () => {
    const users = await clientFetch<User[]>('/users')
    expect(users).toHaveLength(2)
  })
})
```

## 🎯 Best Practices

### **1. Middleware:**
- Giữ middleware nhẹ và focused
- Sử dụng context để share data
- Early returns cho performance
- Proper error handling

### **2. API Clients:**
- Type-safe với TypeScript
- Consistent error handling
- Proper loading states
- Caching strategies

### **3. Security:**
- Never expose sensitive tokens
- Validate inputs
- Use HTTPS in production
- Regular security audits

## 🔍 Troubleshooting

### **Common Issues:**

#### **1. Token không được refresh:**
```
Nguyên nhân: Token middleware không chạy
Giải pháp: Kiểm tra matcher pattern
```

#### **2. CORS errors:**
```
Nguyên nhân: Gọi trực tiếp backend từ browser
Giải pháp: Sử dụng clientFetch thay vì direct calls
```

#### **3. 401 Unauthorized:**
```
Nguyên nhân: Token không được inject
Giải pháp: Kiểm tra proxy middleware và context
```

## 📚 Next Steps

1. **Implement rate limiting** cho API calls
2. **Add request/response logging** cho debugging
3. **Implement retry logic** cho failed requests
4. **Add request deduplication** cho performance
5. **Implement real-time updates** với WebSockets

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Add tests
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.