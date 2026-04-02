import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Calendar, CheckCircle, Clock, Wrench, TrendingUp, Settings } from "lucide-react"
import { useEffect, useState } from "react"


interface Props {
  isMainDashBoard: boolean,
  maintenanceStatus: string[],
  handleTagClicked: (filter: string) => void
}

export default function ExecutionDashBoard({ isMainDashBoard, maintenanceStatus, handleTagClicked }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({})
    
  useEffect(() => {
    const result = maintenanceStatus.reduce((acc, status) => {
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    setCounts(result)
  }, [maintenanceStatus])

  return(
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {!isMainDashBoard &&
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => handleTagClicked("ALL")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 작업 수</CardTitle>
            <Wrench className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.values(counts).reduce((sum, v) => sum + v, 0)}</div>
            <p className="text-xs text-muted-foreground">전체 작업</p>
          </CardContent>
        </Card>
      }
      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => handleTagClicked("DELAYED")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">지연된 작업</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{counts["DELAYED"] ?? 0}</div>
          <p className="text-xs text-muted-foreground">즉시 조치 필요</p>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => handleTagClicked("WEEKLY")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">금주 예정 작업</CardTitle>
          <Calendar className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{counts["WEEKLY"] ?? 0}</div>
          <p className="text-xs text-muted-foreground">이번 주 예정</p>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => handleTagClicked("MONTHLY")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">금월 예정 작업</CardTitle>
          <Clock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{counts["MONTHLY"] ?? 0}</div>
          <p className="text-xs text-muted-foreground">이번 달 예정</p>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => handleTagClicked("COMPLETED")}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">완료된 작업</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{counts["COMPLATE"]}</div>
          <p className="text-xs text-muted-foreground">이번 달 완료</p>
        </CardContent>
      </Card>
    </div>
  )
}
