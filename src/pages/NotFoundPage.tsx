import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">페이지를 찾을 수 없습니다</h2>
      <p className="text-muted-foreground text-sm">요청하신 경로가 존재하지 않습니다.</p>
      <Link to="/" className="text-blue-600 hover:underline">홈으로 돌아가기</Link>
    </div>
  )
}

