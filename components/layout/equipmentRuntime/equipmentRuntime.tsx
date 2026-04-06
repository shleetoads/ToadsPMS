import { useEffect, useState } from "react"
import { EquipmentRuntimeData, MachineRuntimeData } from '@/types/vessel/equipmentRuntime'
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
}

export default function EquipmentRuntime({ vesselNo }: Props) {
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
    return Math.max(...datas.map((data) => data.lastest_runtime))
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

  const Odometer = ({
    value = 0,
    size = "2xl"
  }: {
    value?: number
    size?: string
  }) => {
    const totalMinutes = value ?? 0
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    const hourStr = hours.toString()
    const minStr = minutes.toString().padStart(2, "0")
    
    let textStyle = "text-2xl font-bold"

    switch(size){
      case "xl":
        textStyle = "text-xl font-bold"
        break
      case "2xl":
        textStyle = "text-2xl font-bold"
        break
    }

    return (
    <div className="flex items-end gap-1">
      {/* Hours */}
      <span className={textStyle}>{hourStr}</span>
      <span className="text-sm text-gray-500">H</span>

      {/* Minutes */}
      <span className={textStyle}>{minStr}</span>
      <span className="text-sm text-gray-500">M</span>
    </div>
    )
  }
  
  const handleOnMachineClick = ( machineData: MachineRuntimeData ) => {
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

      if(selectedEquipment.lastest_runtime > runtime){
        alert("입력한 운전시간은 기존 운전시간보다 작을 수 없습니다.")
        return
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

  const MainEngineTag = ({ machineData }: { machineData: MachineRuntimeData }) => {
    return(
      <Card onClick={() => handleOnMachineClick(machineData)}>
        <CardContent>
          <CardHeader className="text-2xl font-semibold"> {machineData.machine_name} </CardHeader>
          <div className="justify-self-center">
            <Odometer value={getMaxRuntime(machineData.equipment_runtime_datas)} />
          </div>
        </CardContent>
      </Card>
    )
  }

  const GeneratorEngineTag = ({ machineData }: { machineData: MachineRuntimeData }) => {
    return(
      <Card onClick={() => handleOnMachineClick(machineData)}>
        <CardContent className="grid grid-cols-[2fr_2fr_1fr]">
          <p className="text-2xl font-semibold"> G/E </p>
          <div>
            {machineData.equipment_runtime_datas.map((equipData) =>
              equipData.equip_name != "EM'CY GENERATOR ENGINE" && (
                <div key={equipData.equip_name} className="grid grid-cols-[1fr_1fr] gap-2 items-end">
                  <span className="text-xl font-semibold justify-self-start">
                    {getSimpleName(equipData.equip_name)}
                  </span>

                  <div className="justify-self-end">
                    <Odometer value={equipData.lastest_runtime} size="xl"/>
                  </div>
                </div>
              ))}
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
          <DialogEquipmentDataTag machineData={selectedMachineData}></DialogEquipmentDataTag>
          </DialogContent>
        </Dialog>
      )
    )
  }

  const MachineTag = ({ machineDatas }: { machineDatas: MachineRuntimeData[] }) => {
    machineDatas.sort((a, b) =>b.machine_name.localeCompare(a.machine_name))
    return(
      <div className="grid grid-cols-2 gap-6">
        {machineDatas.map((machineData) =>
          machineData.machine_name === "MAIN ENGINE" ? (
            <MainEngineTag key={machineData.machine_name} machineData={machineData} />
          ) : (
            <GeneratorEngineTag key={machineData.machine_name} machineData={machineData} />
          )
        )}
      </div>
    )  
  }


  return (
    <div className="mb-6">
      <MachineTag machineDatas={machineRuntimes} />

      {isOpenDialog && (
        <MachineDialog></MachineDialog>
      )}

    </div>
  )
}