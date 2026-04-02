import { Badge } from "@/components/ui/badge"

interface Props {
  status: string | null,
  critical: string | null,
}

export default function ExecutionItemBagde({ status, critical }: Props) {
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELAYED":
        return <Badge variant="destructive">지연</Badge>
      case "EXTENSION":
        return <Badge variant="outline">연장</Badge>
      case "NORMAL":
        return <Badge variant="secondary">예정</Badge>
      case "WEEKLY":
        return <Badge variant="secondary">금주 예정</Badge>
      case "MONTHLY":
        return <Badge variant="secondary">금월 예정</Badge>
      case "COMPLETE":
        return <Badge variant="default">완료</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }
  
  const getCriticalBadge = (critical: string) => {
    switch (critical) {
      case "NORMAL":
        return <Badge variant="outline" className="text-xs">일상정비</Badge>
      case "CRITICAL":
        return <Badge variant="destructive" className="text-xs">Critical</Badge>
      case "DOCK":
        return <Badge variant="secondary" className="text-xs">Dock</Badge>
      case "CMS":
        return <Badge variant="default" className="text-xs">CMS</Badge>
      default:
        return ''
    }
  }


  return(
    <div className="flex items-center gap-2 mb-1">
      {critical && getCriticalBadge(critical)}
      {status && getStatusBadge(status)}
    </div>
  )
}