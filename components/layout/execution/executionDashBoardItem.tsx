import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wrench, AlertTriangle, Calendar, Clock, CheckCircle } from "lucide-react"
import React, { JSX } from "react"


interface Props {
  status: string,
  count: number,
  handleOnClick: (filter: string) => void
}

export default function ExecutionDashBoardItem({ status, count, handleOnClick }: Props) {
  const colorMap: Record<string, string> = {
    ALL: "text-black-600",
    DELAYED: "text-red-600",
    WEEKLY: "text-orange-600",
    MONTHLY: "text-blue-600",
    COMPLETE: "text-green-600",
    SCHEDULED: "text-orange-600",
  }
  const titleMap: Record<string, string> = {
    ALL: "총 작업 수",
    DELAYED: "지연된 작업",
    WEEKLY: "금주 예정 작업",
    MONTHLY: "금월 예정 작업",
    COMPLETE: "완료된 작업",
    SCHEDULED: "예정된 작업",
  }
  const contentsMap: Record<string, string> = {
    ALL: "전체 작업",
    DELAYED: "즉시 조치 필요",
    WEEKLY: "이번 주 예정",
    MONTHLY: "이번 달 예정",
    COMPLETE: "이번 달 완료",
    SCHEDULED: "실행 대기",
  }

  const iconMap: Record<string, JSX.Element> = {
    ALL: <Wrench />,
    DELAYED: <AlertTriangle />,
    WEEKLY: <Calendar />,
    MONTHLY: <Clock />,
    COMPLETE: <CheckCircle />,
    SCHEDULED: <Calendar />,
  }

  const getStatusIcon = () => {
    const base = "h-4 w-4"
    let color = ""

    if(status == "ALL") //All Icon -> BLUE...
      color = colorMap["MONTHLY"]
    else
      color = colorMap[status ?? ""] ?? "text-gray-600"


    const Icon = iconMap[status ?? ""]

    if (!Icon) return null

    return React.cloneElement(Icon, {
      className: `${base} ${color}`,
    })
  }

  const getContentsTextStyle = () => {
    const base = "text-2xl font-bold"
    return `${base} ${colorMap[status ?? ""] ?? "text-gray-600"}`
  }
  return(
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => handleOnClick(status)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{titleMap[status?? ""]}</CardTitle>
        {getStatusIcon()}
      </CardHeader>
      <CardContent>
        <div className={getContentsTextStyle()}>{count}</div>
        <p className="text-xs text-muted-foreground">{contentsMap[status?? ""]}</p>
      </CardContent>
    </Card>
  )
}
