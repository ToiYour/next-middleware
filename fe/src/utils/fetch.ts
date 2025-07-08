export const fetchWithAuth = async (input: RequestInfo, init?: RequestInit) => {
  let res = await fetch(input, { ...init, credentials: 'include' })

  // Nếu bị 401 → thử gọi refresh
  if (res.status === 401) {
    const refreshRes = await fetch('/api/refresh-token', {
      method: 'POST',
      credentials: 'include',
    })

    const data = await refreshRes.json()

    if (refreshRes.ok && data.accessToken) {
      // Gọi lại request gốc sau khi refresh thành công
      res = await fetch(input, { ...init, credentials: 'include' })
    }
  }

  return res
}
