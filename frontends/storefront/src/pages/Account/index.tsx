import { useAuth } from '@/auth/context'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'

export const AccountPage = () => {
  const { session, login, logout } = useAuth()
  return (
  <main className="mx-auto max-w-5xl px-6 py-10">
    <PageHeader label="Account" title="アカウント" />
    {session ? <div className="space-y-4 text-soft"><p>ログイン中: {session.profile.name ?? 'ユーザー'}</p><p>{session.profile.email}</p><Button onClick={() => void logout()}>ログアウト</Button></div>
      : <div className="space-y-5 text-soft"><p>注文と注文履歴にはログインが必要です。</p><Button onClick={() => void login()}>ログイン</Button><p className="text-sm text-dim">開発用: customer-one / CustomerOne1!</p></div>}
  </main>
  )
}
