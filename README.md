# next-middleware
Chắc chắn rồi! Dưới đây là giải thích chi tiết về toàn bộ hệ thống middleware bạn đã cung cấp.

Hệ thống này được thiết kế theo một kiến trúc rất linh hoạt và dễ mở rộng, sử dụng một chuỗi các "middleware con" để xử lý các khía cạnh khác nhau của một request.

### **Tổng quan kiến trúc**

Kiến trúc này hoạt động theo nguyên tắc "Chain of Responsibility" (Chuỗi Trách Nhiệm).

1.  **Một Entry Point duy nhất:** `middleware.ts` là file middleware chính của Next.js. Tất cả các request phù hợp với `config.matcher` sẽ đi qua file này đầu tiên.
2.  **Dispatcher (Bộ điều phối):** File `middleware.ts` hoạt động như một bộ điều phối. Nó không tự mình xử lý logic phức tạp, mà duyệt qua một danh sách các "middleware con" (`tokenApiMiddleware`, `authApiMiddleware`, `roleMiddleware`).
3.  **Middleware con chuyên biệt:** Mỗi middleware con có một trách nhiệm duy nhất (Single Responsibility Principle):
    *   `tokenApiMiddleware`: Quản lý việc làm mới (refresh) access token.
    *   `authApiMiddleware`: Xác thực người dùng (đã đăng nhập chưa?).
    *   `roleMiddleware`: Phân quyền người dùng (có đúng vai trò không?).
    *   `proxyApiMiddleware`: Chuyển tiếp (proxy) các request đến API server backend.
4.  **Cơ chế Matcher/Excluded:** Mỗi middleware con có `matcher` và `excluded` riêng, cho phép nó chỉ chạy trên những đường dẫn (path) cần thiết, tăng hiệu suất và sự rõ ràng.
5.  **Truyền Response:** Biến `res` (`NextResponse`) được truyền từ middleware này sang middleware khác. Điều này rất quan trọng, vì một middleware có thể thay đổi response (ví dụ: set cookie) và middleware tiếp theo có thể sử dụng thông tin đã được thay đổi đó.

---

### **Phân tích từng File**

#### 1. `middlewares/type.ts` (File định nghĩa kiểu dữ liệu)

File này (dù không được cung cấp) sẽ định nghĩa một interface `IMiddleware` để đảm bảo tất cả các middleware con đều tuân thủ một cấu trúc chung.

```typescript
// giả định nội dung file middlewares/type.ts
import { NextRequest, NextResponse } from 'next/server';

export interface IMiddleware {
  // Regex để xác định middleware này có nên chạy trên path hiện tại không.
  matcher: RegExp;
  // Regex để loại trừ các path cụ thể khỏi matcher.
  excluded: RegExp;
  // Hàm xử lý logic chính của middleware.
  // Nhận vào request và response hiện tại, trả về một response mới.
  handle: (req: NextRequest, res: NextResponse) => Promise<NextResponse> | NextResponse;
}
```

Đây là một thiết kế rất tốt, giúp code dễ đọc, dễ bảo trì và dễ dàng thêm middleware mới trong tương lai.

#### 2. `middleware.ts` (File Middleware chính - Bộ điều phối)

Đây là trái tim của hệ thống.

```typescript
// middleware.ts

// ... imports
import { tokenApiMiddleware } from './middlewares/token.middlewares'
import { authApiMiddleware } from './middlewares/auth.middlewares'
import { roleMiddleware } from './middlewares/role.middlewares'

// Danh sách các middleware con, được thực thi theo thứ tự này.
const middlewares: IMiddleware[] = [
  tokenApiMiddleware,
  authApiMiddleware,
  roleMiddleware
  // Lưu ý: proxyApiMiddleware không được thêm vào đây trong code bạn cung cấp.
];

export async function middleware(req: NextRequest) {
  // ...
  // Bắt đầu với một response mặc định: cho phép request đi tiếp.
  let res = NextResponse.next();

  // Vòng lặp qua từng middleware con
  for (const middleware of middlewares) {
    // 1. Kiểm tra xem path có khớp với matcher của middleware không
    if (!middleware.matcher.test(pathName)) continue;
    // 2. Kiểm tra xem path có bị loại trừ không
    if (middleware.excluded.test(pathName)) continue;

    // 3. Nếu hợp lệ, gọi hàm handle của middleware con
    // Truyền vào `req` và `res` hiện tại.
    const midRes = await middleware.handle(req, res);

    // 4. Kiểm tra xem middleware con có trả về một response mới không
    // NextResponse.next() là tín hiệu "không làm gì cả, đi tiếp".
    // Nếu nó trả về cái gì khác (như redirect, rewrite, hoặc response có set cookie),
    // ta sẽ cập nhật biến `res` chung.
    if (midRes !== NextResponse?.next()) {
      res = midRes;
    }
  }

  // 5. Trả về response cuối cùng sau khi đã qua tất cả các middleware.
  return res;
}
```

*   **Logic quan trọng:** Biến `res` được khởi tạo bằng `NextResponse.next()` và được truyền qua từng `handle`. Nếu một `handle` (ví dụ `tokenApiMiddleware`) set một cookie mới vào `res`, thì `handle` tiếp theo (`authApiMiddleware`) sẽ nhận được `res` đã có cookie đó. Đây là cách các middleware "giao tiếp" với nhau.

#### 3. `middlewares/token.middlewares.ts` (Quản lý Token)

*   **Mục đích:** Đảm bảo người dùng luôn có một access token hợp lệ nếu họ có refresh token.
*   **`matcher: /.*/`:** Chạy trên TẤT CẢ các request. Điều này là cần thiết vì người dùng có thể đang ở bất kỳ trang nào khi access token hết hạn.
*   **`excluded: /^$/`:** Loại trừ trang gốc (`/`), có thể đây là một yêu cầu cụ thể của dự án.
*   **Luồng hoạt động:**
    1.  Kiểm tra xem `refreshToken` có tồn tại trong cookie không. Nếu không, bỏ qua.
    2.  Kiểm tra `accessToken`:
        *   Nếu không có hoặc hết hạn (dựa vào `payload.exp`), `isExpired` là `true`.
        *   Nếu còn hạn, bỏ qua.
    3.  Nếu `isExpired` là `true`, nó sẽ gọi đến API endpoint `/api/refresh-token`.
    4.  Nếu gọi API thành công, nó sẽ lấy `accessToken` mới từ response và **set nó vào cookie của `res`**.
    5.  Sau đó nó trả về `res` (giờ đã chứa cookie `accessToken` mới).
    6.  Nếu gọi API thất bại, nó sẽ xoá `accessToken` cũ đi.

#### 4. `middlewares/auth.middlewares.ts` (Xác thực)

*   **Mục đích:** Bảo vệ các trang quản trị (`/admin`). Chỉ cho phép người dùng đã đăng nhập truy cập.
*   **`matcher: /^\/admin/`:** Chỉ chạy trên các trang có đường dẫn bắt đầu bằng `/admin`.
*   **`excluded: /^\/login$/`:** Loại trừ trang login để tránh vòng lặp chuyển hướng vô tận.
*   **Luồng hoạt động:**
    1.  **Lấy `accessToken`:** Nó cố gắng lấy token từ `req.cookies` (token từ request gốc) HOẶC từ `res.cookies` (token có thể vừa được `tokenApiMiddleware` làm mới). Đây là một chi tiết cực kỳ quan trọng!
        ```typescript
        const accessToken =  req.cookies.get('accessToken')?.value || res?.cookies.get('accessToken')?.value
        ```
    2.  Nếu không có `accessToken`, chuyển hướng người dùng về trang `/login`.
    3.  Nếu có, giải mã token để kiểm tra thời gian hết hạn (`exp`). Nếu hết hạn, cũng chuyển hướng về `/login`.
    4.  Nếu mọi thứ hợp lệ, nó trả về `res` (cho phép request đi tiếp).

#### 5. `middlewares/role.middlewares.ts` (Phân quyền)

*   **Mục đích:** Sau khi xác thực, middleware này kiểm tra xem người dùng có đúng vai trò (`role`) để truy cập khu vực `/admin` hay không.
*   **`matcher` và `excluded`:** Giống hệt `authApiMiddleware` vì chúng cùng bảo vệ một khu vực.
*   **Luồng hoạt động:**
    1.  Lấy `accessToken` (tương tự như `authApiMiddleware`).
    2.  Nếu không có token, chuyển hướng về `/login`.
    3.  Giải mã payload của token.
    4.  Kiểm tra trường `payload.role`. Nếu không phải là `'admin'`, chuyển hướng người dùng về trang chủ (`/`).
    5.  Nếu vai trò là `admin`, cho phép request đi tiếp.

#### 6. `middlewares/proxy.middlewares.ts` (Proxy API)

*   **Mục đích:** Chuyển tiếp các request từ client-side (ví dụ: `fetch('/api/users')`) đến một server API backend thực sự, đồng thời tự động đính kèm `accessToken` để xác thực.
*   **`matcher: /^\/api\//`:** Chạy trên tất cả các request có đường dẫn bắt đầu bằng `/api/`.
*   **Luồng hoạt động:**
    1.  Lấy `accessToken`.
    2.  Nếu có token, nó tạo một `Headers` mới.
    3.  Set header `Authorization: Bearer <accessToken>`.
    4.  Lấy URL của API backend từ biến môi trường `process.env.API_URL`.
    5.  Sử dụng `NextResponse.rewrite()` để "ghi đè" request này sang URL của API backend mà không làm thay đổi URL trên trình duyệt của người dùng. Request sẽ được gửi đi với header `Authorization` đã được thêm vào.

---

### **Luồng hoạt động tổng thể (Ví dụ thực tế)**

Hãy xem một ví dụ: **Một admin có access token đã hết hạn truy cập trang `/admin/dashboard`**.

1.  **Request tới `/admin/dashboard`**.
2.  **`middleware.ts` (chính) bắt đầu.**
3.  **Vòng lặp, `tokenApiMiddleware` chạy:**
    *   `matcher` (`/.*/) khớp.
    *   `handle` được gọi. Nó phát hiện `accessToken` đã hết hạn.
    *   Nó gọi `POST /api/refresh-token` thành công.
    *   Nó nhận về một `accessToken` mới và `res.cookies.set('accessToken', ...)` được gọi.
    *   Hàm trả về `res` giờ đã có lệnh `Set-Cookie` cho `accessToken` mới.
    *   `middleware.ts` (chính) cập nhật `let res = midRes`.
4.  **Vòng lặp, `authApiMiddleware` chạy:**
    *   `matcher` (`/^\/admin/`) khớp.
    *   `handle` được gọi. Nó đọc `accessToken` từ `res.cookies.get('accessToken').value` -> Nó thấy **token mới** vừa được tạo ở bước 3.
    *   Nó kiểm tra token mới này -> còn hạn.
    *   Hàm trả về `res` (không thay đổi gì thêm). Request được thông qua.
5.  **Vòng lặp, `roleMiddleware` chạy:**
    *   `matcher` (`/^\/admin/`) khớp.
    *   `handle` được gọi. Nó cũng đọc được `accessToken` mới từ `res`.
    *   Nó kiểm tra payload, thấy `role: 'admin'`.
    *   Hàm trả về `res` (không thay đổi gì thêm). Request được thông qua.
6.  **`middleware.ts` (chính) kết thúc vòng lặp.**
7.  Nó trả về `res` cuối cùng. `res` này vừa cho phép request đi đến trang `/admin/dashboard`, vừa chứa một header `Set-Cookie` để trình duyệt lưu lại `accessToken` mới.

**Kết quả:** Người dùng truy cập trang thành công và session của họ được tự động làm mới mà họ không hề hay biết. Đây là một trải nghiệm người dùng rất tốt.Chắc chắn rồi! Dưới đây là giải thích chi tiết về toàn bộ hệ thống middleware bạn đã cung cấp.

Hệ thống này được thiết kế theo một kiến trúc rất linh hoạt và dễ mở rộng, sử dụng một chuỗi các "middleware con" để xử lý các khía cạnh khác nhau của một request.

### **Tổng quan kiến trúc**

Kiến trúc này hoạt động theo nguyên tắc "Chain of Responsibility" (Chuỗi Trách Nhiệm).

1.  **Một Entry Point duy nhất:** `middleware.ts` là file middleware chính của Next.js. Tất cả các request phù hợp với `config.matcher` sẽ đi qua file này đầu tiên.
2.  **Dispatcher (Bộ điều phối):** File `middleware.ts` hoạt động như một bộ điều phối. Nó không tự mình xử lý logic phức tạp, mà duyệt qua một danh sách các "middleware con" (`tokenApiMiddleware`, `authApiMiddleware`, `roleMiddleware`).
3.  **Middleware con chuyên biệt:** Mỗi middleware con có một trách nhiệm duy nhất (Single Responsibility Principle):
    *   `tokenApiMiddleware`: Quản lý việc làm mới (refresh) access token.
    *   `authApiMiddleware`: Xác thực người dùng (đã đăng nhập chưa?).
    *   `roleMiddleware`: Phân quyền người dùng (có đúng vai trò không?).
    *   `proxyApiMiddleware`: Chuyển tiếp (proxy) các request đến API server backend.
4.  **Cơ chế Matcher/Excluded:** Mỗi middleware con có `matcher` và `excluded` riêng, cho phép nó chỉ chạy trên những đường dẫn (path) cần thiết, tăng hiệu suất và sự rõ ràng.
5.  **Truyền Response:** Biến `res` (`NextResponse`) được truyền từ middleware này sang middleware khác. Điều này rất quan trọng, vì một middleware có thể thay đổi response (ví dụ: set cookie) và middleware tiếp theo có thể sử dụng thông tin đã được thay đổi đó.

---

### **Phân tích từng File**

#### 1. `middlewares/type.ts` (File định nghĩa kiểu dữ liệu)

File này (dù không được cung cấp) sẽ định nghĩa một interface `IMiddleware` để đảm bảo tất cả các middleware con đều tuân thủ một cấu trúc chung.

```typescript
// giả định nội dung file middlewares/type.ts
import { NextRequest, NextResponse } from 'next/server';

export interface IMiddleware {
  // Regex để xác định middleware này có nên chạy trên path hiện tại không.
  matcher: RegExp;
  // Regex để loại trừ các path cụ thể khỏi matcher.
  excluded: RegExp;
  // Hàm xử lý logic chính của middleware.
  // Nhận vào request và response hiện tại, trả về một response mới.
  handle: (req: NextRequest, res: NextResponse) => Promise<NextResponse> | NextResponse;
}
```

Đây là một thiết kế rất tốt, giúp code dễ đọc, dễ bảo trì và dễ dàng thêm middleware mới trong tương lai.

#### 2. `middleware.ts` (File Middleware chính - Bộ điều phối)

Đây là trái tim của hệ thống.

```typescript
// middleware.ts

// ... imports
import { tokenApiMiddleware } from './middlewares/token.middlewares'
import { authApiMiddleware } from './middlewares/auth.middlewares'
import { roleMiddleware } from './middlewares/role.middlewares'

// Danh sách các middleware con, được thực thi theo thứ tự này.
const middlewares: IMiddleware[] = [
  tokenApiMiddleware,
  authApiMiddleware,
  roleMiddleware
  // Lưu ý: proxyApiMiddleware không được thêm vào đây trong code bạn cung cấp.
];

export async function middleware(req: NextRequest) {
  // ...
  // Bắt đầu với một response mặc định: cho phép request đi tiếp.
  let res = NextResponse.next();

  // Vòng lặp qua từng middleware con
  for (const middleware of middlewares) {
    // 1. Kiểm tra xem path có khớp với matcher của middleware không
    if (!middleware.matcher.test(pathName)) continue;
    // 2. Kiểm tra xem path có bị loại trừ không
    if (middleware.excluded.test(pathName)) continue;

    // 3. Nếu hợp lệ, gọi hàm handle của middleware con
    // Truyền vào `req` và `res` hiện tại.
    const midRes = await middleware.handle(req, res);

    // 4. Kiểm tra xem middleware con có trả về một response mới không
    // NextResponse.next() là tín hiệu "không làm gì cả, đi tiếp".
    // Nếu nó trả về cái gì khác (như redirect, rewrite, hoặc response có set cookie),
    // ta sẽ cập nhật biến `res` chung.
    if (midRes !== NextResponse?.next()) {
      res = midRes;
    }
  }

  // 5. Trả về response cuối cùng sau khi đã qua tất cả các middleware.
  return res;
}
```

*   **Logic quan trọng:** Biến `res` được khởi tạo bằng `NextResponse.next()` và được truyền qua từng `handle`. Nếu một `handle` (ví dụ `tokenApiMiddleware`) set một cookie mới vào `res`, thì `handle` tiếp theo (`authApiMiddleware`) sẽ nhận được `res` đã có cookie đó. Đây là cách các middleware "giao tiếp" với nhau.

#### 3. `middlewares/token.middlewares.ts` (Quản lý Token)

*   **Mục đích:** Đảm bảo người dùng luôn có một access token hợp lệ nếu họ có refresh token.
*   **`matcher: /.*/`:** Chạy trên TẤT CẢ các request. Điều này là cần thiết vì người dùng có thể đang ở bất kỳ trang nào khi access token hết hạn.
*   **`excluded: /^$/`:** Loại trừ trang gốc (`/`), có thể đây là một yêu cầu cụ thể của dự án.
*   **Luồng hoạt động:**
    1.  Kiểm tra xem `refreshToken` có tồn tại trong cookie không. Nếu không, bỏ qua.
    2.  Kiểm tra `accessToken`:
        *   Nếu không có hoặc hết hạn (dựa vào `payload.exp`), `isExpired` là `true`.
        *   Nếu còn hạn, bỏ qua.
    3.  Nếu `isExpired` là `true`, nó sẽ gọi đến API endpoint `/api/refresh-token`.
    4.  Nếu gọi API thành công, nó sẽ lấy `accessToken` mới từ response và **set nó vào cookie của `res`**.
    5.  Sau đó nó trả về `res` (giờ đã chứa cookie `accessToken` mới).
    6.  Nếu gọi API thất bại, nó sẽ xoá `accessToken` cũ đi.

#### 4. `middlewares/auth.middlewares.ts` (Xác thực)

*   **Mục đích:** Bảo vệ các trang quản trị (`/admin`). Chỉ cho phép người dùng đã đăng nhập truy cập.
*   **`matcher: /^\/admin/`:** Chỉ chạy trên các trang có đường dẫn bắt đầu bằng `/admin`.
*   **`excluded: /^\/login$/`:** Loại trừ trang login để tránh vòng lặp chuyển hướng vô tận.
*   **Luồng hoạt động:**
    1.  **Lấy `accessToken`:** Nó cố gắng lấy token từ `req.cookies` (token từ request gốc) HOẶC từ `res.cookies` (token có thể vừa được `tokenApiMiddleware` làm mới). Đây là một chi tiết cực kỳ quan trọng!
        ```typescript
        const accessToken =  req.cookies.get('accessToken')?.value || res?.cookies.get('accessToken')?.value
        ```
    2.  Nếu không có `accessToken`, chuyển hướng người dùng về trang `/login`.
    3.  Nếu có, giải mã token để kiểm tra thời gian hết hạn (`exp`). Nếu hết hạn, cũng chuyển hướng về `/login`.
    4.  Nếu mọi thứ hợp lệ, nó trả về `res` (cho phép request đi tiếp).

#### 5. `middlewares/role.middlewares.ts` (Phân quyền)

*   **Mục đích:** Sau khi xác thực, middleware này kiểm tra xem người dùng có đúng vai trò (`role`) để truy cập khu vực `/admin` hay không.
*   **`matcher` và `excluded`:** Giống hệt `authApiMiddleware` vì chúng cùng bảo vệ một khu vực.
*   **Luồng hoạt động:**
    1.  Lấy `accessToken` (tương tự như `authApiMiddleware`).
    2.  Nếu không có token, chuyển hướng về `/login`.
    3.  Giải mã payload của token.
    4.  Kiểm tra trường `payload.role`. Nếu không phải là `'admin'`, chuyển hướng người dùng về trang chủ (`/`).
    5.  Nếu vai trò là `admin`, cho phép request đi tiếp.

#### 6. `middlewares/proxy.middlewares.ts` (Proxy API)

*   **Mục đích:** Chuyển tiếp các request từ client-side (ví dụ: `fetch('/api/users')`) đến một server API backend thực sự, đồng thời tự động đính kèm `accessToken` để xác thực.
*   **`matcher: /^\/api\//`:** Chạy trên tất cả các request có đường dẫn bắt đầu bằng `/api/`.
*   **Luồng hoạt động:**
    1.  Lấy `accessToken`.
    2.  Nếu có token, nó tạo một `Headers` mới.
    3.  Set header `Authorization: Bearer <accessToken>`.
    4.  Lấy URL của API backend từ biến môi trường `process.env.API_URL`.
    5.  Sử dụng `NextResponse.rewrite()` để "ghi đè" request này sang URL của API backend mà không làm thay đổi URL trên trình duyệt của người dùng. Request sẽ được gửi đi với header `Authorization` đã được thêm vào.

---

### **Luồng hoạt động tổng thể (Ví dụ thực tế)**

Hãy xem một ví dụ: **Một admin có access token đã hết hạn truy cập trang `/admin/dashboard`**.

1.  **Request tới `/admin/dashboard`**.
2.  **`middleware.ts` (chính) bắt đầu.**
3.  **Vòng lặp, `tokenApiMiddleware` chạy:**
    *   `matcher` (`/.*/) khớp.
    *   `handle` được gọi. Nó phát hiện `accessToken` đã hết hạn.
    *   Nó gọi `POST /api/refresh-token` thành công.
    *   Nó nhận về một `accessToken` mới và `res.cookies.set('accessToken', ...)` được gọi.
    *   Hàm trả về `res` giờ đã có lệnh `Set-Cookie` cho `accessToken` mới.
    *   `middleware.ts` (chính) cập nhật `let res = midRes`.
4.  **Vòng lặp, `authApiMiddleware` chạy:**
    *   `matcher` (`/^\/admin/`) khớp.
    *   `handle` được gọi. Nó đọc `accessToken` từ `res.cookies.get('accessToken').value` -> Nó thấy **token mới** vừa được tạo ở bước 3.
    *   Nó kiểm tra token mới này -> còn hạn.
    *   Hàm trả về `res` (không thay đổi gì thêm). Request được thông qua.
5.  **Vòng lặp, `roleMiddleware` chạy:**
    *   `matcher` (`/^\/admin/`) khớp.
    *   `handle` được gọi. Nó cũng đọc được `accessToken` mới từ `res`.
    *   Nó kiểm tra payload, thấy `role: 'admin'`.
    *   Hàm trả về `res` (không thay đổi gì thêm). Request được thông qua.
6.  **`middleware.ts` (chính) kết thúc vòng lặp.**
7.  Nó trả về `res` cuối cùng. `res` này vừa cho phép request đi đến trang `/admin/dashboard`, vừa chứa một header `Set-Cookie` để trình duyệt lưu lại `accessToken` mới.

**Kết quả:** Người dùng truy cập trang thành công và session của họ được tự động làm mới mà họ không hề hay biết. Đây là một trải nghiệm người dùng rất tốt.