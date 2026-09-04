import { useEffect, useState } from "react"
import { EquipmentRuntimeData, MachineRuntimeData } from '@/types/vessel/equipmentRuntime'
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import EquipmentRuntimeInput from "./equipmentRuntimeInput"

interface Props {
  vesselNo: string
  editable?: boolean
  compact?: boolean
}

export default function EquipmentRuntime({ vesselNo, editable = true, compact = false }: Props) {
  console.log(vesselNo)

  const [machineRuntimes, setMachineRuntimes] = useState<MachineRuntimeData[]>([])
  const [isOpenDialog, setIsOpenDialog] = useState(false)
  const [selectedMachineData, setSelectedMachineData] = useState<MachineRuntimeData>()

  const fetchEquipmentRuntimes = (vesselNo: string) => {
    fetch(`/api/ship/equipmentRuntime/all?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachineRuntimes(data))
      .catch(err => console.error(err))
  }
  
  useEffect(() => {
    fetchEquipmentRuntimes(vesselNo)
  }, [vesselNo])

  
  function getMaxRuntime(datas: EquipmentRuntimeData[]) {
    if (!datas || datas.length === 0) return 0
    return Math.max(...datas.map((data) => data.lastest_runtime ?? 0))
  }

  // 운전시간은 분 단위로 저장되므로 안내 문구에서는 H/M 으로 환산해 보여준다.
  function formatRuntime(totalMinutes: number) {
    const v = totalMinutes ?? 0
    return `${Math.floor(v / 60)}H ${String(v % 60).padStart(2, "0")}M`
  }

  function getSimpleName(name: string) {
    return name.split(" ")[0]
  }
  
  const formatDateKST = (date?: string) => {
    if (!date) return "0000-00-00 00:00"

    return new Date(date)
      .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
      .slice(0, 16) + " (KST)"
  }
    
  type OdometerProps = {
    value?: number
    size?: "sm" | "lg" | "xl" | "2xl"
  }

  const Odometer = ({ value = 0, size = "2xl" }: OdometerProps) => {
    const totalMinutes = value ?? 0
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    const hourStr = hours.toString()
    const minStr = minutes.toString().padStart(2, "0")

    const sizeMap = {
      sm: "text-sm",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
    }

    const textStyle = `${sizeMap[size]} font-bold`
    const unitStyle = size === "sm" || size === "lg" ? "text-xs text-gray-500" : "text-sm text-gray-500"

    return (
      <div className="flex items-end gap-1">
        <span className={textStyle}>{hourStr}</span>
        <span className={unitStyle}>H</span>
        <span className={textStyle}>{minStr}</span>
        <span className={unitStyle}>M</span>
      </div>
    )
  }
    
  const handleOnMachineClick = ( machineData: MachineRuntimeData ) => {
    if (!editable) return
    // 장비 데이터가 없는(0 표시 전용) 카드는 입력 다이얼로그를 열지 않는다.
    if (!machineData.equipment_runtime_datas || machineData.equipment_runtime_datas.length === 0) return
    setSelectedMachineData(machineData)
    setIsOpenDialog(true)
  }

  const DialogEquipmentDataTag = ({ machineData }: { machineData: MachineRuntimeData }) => {
    const [selectedName, setSelectedName] = useState('')
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRuntimeData>()
    const [runtime, setRuntime] = useState(0)
    
    useEffect(() => {
      setSelectedEquipment(machineData.equipment_runtime_datas.find((equip) => (equip.equip_name === selectedName)))
   }, [selectedName])


    const handleInsert = async (runtime : number) => {
      if(!selectedEquipment) return

      // 기존 값보다 작은 운전시간도 입력할 수 있으나, 오입력 방지를 위해 확인을 받는다.
      if(selectedEquipment.lastest_runtime > runtime){
        const confirmed = confirm(
          `입력한 운전시간(${formatRuntime(runtime)})이 기존 운전시간(${formatRuntime(selectedEquipment.lastest_runtime)})보다 작습니다.\n` +
          `정비 주기 계산에 영향을 줄 수 있습니다. 그대로 저장하시겠습니까?`
        )
        if (!confirmed) return
      }

      const insertedData = {
        vesselNo: selectedEquipment.vessel_no,
        equipNo: selectedEquipment.equip_no,
        equipName: selectedEquipment.equip_name,
        machineName: selectedEquipment.machine_name,
        runtime: runtime,
      };

      const res = await fetch('/api/ship/equipmentRuntime/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertedData),
      });

      const data = await res.json();

      if (data.success) {
        alert("저장이 완료되었습니다.")
        setIsOpenDialog(false)  
        fetchEquipmentRuntimes(vesselNo)
      } else {
        alert(data.message);
      }
    }

    const OnInsertData = (runtime : number) => {
      handleInsert(runtime)
    }

    return(
      <div key={"dialog_" + machineData.machine_name}>
        <div className="mb-4">
          <span className="text-sx"> {machineData.machine_name} </span>
          <Select value={selectedName} onValueChange={setSelectedName}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="장비 선택"/>
            </SelectTrigger>
            <SelectContent>
              {machineData.equipment_runtime_datas.map((equip) => (
                <SelectItem key={equip.equip_name} value={equip.equip_name}> {equip.equip_name} </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedEquipment && (
          <Card>
            <CardContent>
              <Odometer value={selectedEquipment.lastest_runtime ?? 0} />
              <span className="text-gray-500 text-sm">
                Last Update : {formatDateKST(selectedEquipment.lastest_upload_date)}
              </span>
            </CardContent>
            <CardContent className="flex flex-col gap-2">
              <EquipmentRuntimeInput
                equip_name={selectedEquipment.equip_name}
                machine_name={selectedEquipment.machine_name}
                handleRuntimeChanged={setRuntime}
              />

              <Button className="self-end" onClick={() => OnInsertData(runtime)}> 수정 </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )  
  }

  const MainEngineDialogTag = ({ machineData }: { machineData: MachineRuntimeData }) => {
    const [runtime, setRuntime] = useState(0)

    const cylinders = machineData.equipment_runtime_datas
    const currentMax = getMaxRuntime(cylinders)
    const latestCylinder = cylinders.reduce(
      (max, cur) => (cur.lastest_runtime > max.lastest_runtime ? cur : max),
      cylinders[0]
    )

    // MAIN ENGINE은 모든 실린더가 함께 운전되어 운전시간이 동일하므로,
    // 실린더 선택 없이 하나의 값을 모든 실린더에 일괄 기입한다.
    const handleInsert = async (runtime: number) => {
      // 기존 값보다 작은 운전시간도 입력할 수 있으나, 오입력 방지를 위해 확인을 받는다.
      if (currentMax > runtime) {
        const confirmed = confirm(
          `입력한 운전시간(${formatRuntime(runtime)})이 기존 운전시간(${formatRuntime(currentMax)})보다 작습니다.\n` +
          `정비 주기 계산에 영향을 줄 수 있습니다. 그대로 저장하시겠습니까?`
        )
        if (!confirmed) return
      }

      for (const cylinder of cylinders) {
        const res = await fetch('/api/ship/equipmentRuntime/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vesselNo: cylinder.vessel_no,
            equipNo: cylinder.equip_no,
            equipName: cylinder.equip_name,
            machineName: cylinder.machine_name,
            runtime: runtime,
          }),
        })

        const data = await res.json()

        if (!data.success) {
          alert(data.message)
          return
        }
      }

      alert("저장이 완료되었습니다.")
      setIsOpenDialog(false)
      fetchEquipmentRuntimes(vesselNo)
    }

    return (
      <div key={"dialog_" + machineData.machine_name}>
        <div className="mb-4">
          <span className="text-sx"> {machineData.machine_name} </span>
        </div>

        <Card>
          <CardContent>
            <Odometer value={currentMax} />
            <span className="text-gray-500 text-sm">
              Last Update : {formatDateKST(latestCylinder?.lastest_upload_date)}
            </span>
          </CardContent>
          <CardContent className="flex flex-col gap-2">
            <EquipmentRuntimeInput
              equip_name={machineData.machine_name}
              machine_name={machineData.machine_name}
              handleRuntimeChanged={setRuntime}
            />

            <Button className="self-end" onClick={() => handleInsert(runtime)}> 수정 </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const MainEngineTag = ({ machineData }: { machineData: MachineRuntimeData }) => {
    return (
      <Card
        onClick={() => handleOnMachineClick(machineData)}
        className={compact ? "gap-1 py-3" : "h-full"}
      >
        <CardHeader className={compact ? "px-3" : "flex flex-row items-center justify-between space-y-0 pb-2"}>
          <CardTitle className={compact ? "text-xs font-medium text-gray-600" : "text-sm font-medium"}>
            {machineData.machine_name}
          </CardTitle>
        </CardHeader>

        <CardContent className={compact ? "flex justify-center px-3" : undefined}>
          <Odometer value={getMaxRuntime(machineData.equipment_runtime_datas)} size={compact ? "lg" : "2xl"} />
        </CardContent>
      </Card>
    )
  }

  const GeneratorEngineTag = ({ machineData }: { machineData: MachineRuntimeData }) => {
    return (
      <Card
        onClick={() => handleOnMachineClick(machineData)}
        className={compact ? "gap-1 py-3" : "h-full"}
      >
        <CardContent className={compact ? "px-3" : undefined}>
          <CardTitle className={compact ? "text-xs font-medium text-gray-600 mb-1" : "text-sm font-medium mb-2"}> G/E </CardTitle>
          <div className={compact ? "space-y-0.5" : "space-y-1"}>
            {(() => {
              const generators = machineData.equipment_runtime_datas.filter(
                (equipData) => equipData.equip_name !== "EM'CY GENERATOR ENGINE"
              )

              // 표시할 제너레이터가 없으면 0 하나만 표시한다.
              if (generators.length === 0) {
                return (
                  <div className="flex justify-end">
                    <Odometer value={0} size={compact ? "sm" : "lg"} />
                  </div>
                )
              }

              return generators.map((equipData) => (
                <div
                  key={equipData.equip_no}
                  className="grid grid-cols-2 gap-2"
                >
                  <span className={compact ? "text-xs justify-self-start" : "text-sm justify-self-start"}>
                    {getSimpleName(equipData.equip_name)}
                  </span>

                  <div className="justify-self-end">
                    <Odometer value={equipData.lastest_runtime} size={compact ? "sm" : "lg"} />
                  </div>
                </div>
              ))
            })()}
          </div>
        </CardContent>
      </Card>
    )
  }

  const MachineDialog = () => {
    return(
      selectedMachineData && (
        <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
          <DialogContent>
          <DialogTitle>장비 운전 시간 관리</DialogTitle>
          {selectedMachineData.machine_name === "MAIN ENGINE" ? (
            <MainEngineDialogTag machineData={selectedMachineData} />
          ) : (
            <DialogEquipmentDataTag machineData={selectedMachineData} />
          )}
          </DialogContent>
        </Dialog>
      )
    )
  }

  const MachineTag = ({ machineDatas }: { machineDatas: MachineRuntimeData[] }) => {
    // 모든 선박에 대해 MAIN ENGINE / G·E 두 카드를 항상 렌더링한다.
    // 해당 장비 데이터가 없으면 빈 그룹으로 두어 0으로 표시한다.
    const meData: MachineRuntimeData =
      machineDatas.find((m) => m.machine_name === "MAIN ENGINE") ?? {
        vessel_no: vesselNo,
        machine_name: "MAIN ENGINE",
        equipment_runtime_datas: [],
      }
    const geData: MachineRuntimeData =
      machineDatas.find((m) => m.machine_name === "GENERATOR ENGINE") ?? {
        vessel_no: vesselNo,
        machine_name: "GENERATOR ENGINE",
        equipment_runtime_datas: [],
      }

    return(
      <div className={compact ? "grid grid-cols-2 gap-4" : "grid grid-cols-2 gap-6 h-full"}>
        <MainEngineTag key="MAIN ENGINE" machineData={meData} />
        <GeneratorEngineTag key="GENERATOR ENGINE" machineData={geData} />
      </div>
    )
  }


  return (
    <div className={compact ? "" : "h-full"}>
      <MachineTag machineDatas={machineRuntimes} />
      {isOpenDialog && (
        <MachineDialog></MachineDialog>
      )}

    </div>
  )
}