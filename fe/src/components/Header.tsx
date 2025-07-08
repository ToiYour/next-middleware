import { serverFetch } from "@/utils/fetch"

export default async function Header() {
  const data = await serverFetch(`/profile`) as {user:{id:number, username:string} & Record<'username' | 'role',string>}

  console.log("🚀 ~ Header ~ user:", data?.user)
  return (
    <header className="p-4 border-b">
      {data?.user ? (
        <div>
          Welcome, <strong>{data?.user.username}</strong> ({data?.user.role})
        </div>
      ) : (
        <div>Not logged in</div>
      )}
    </header>
  )
}
