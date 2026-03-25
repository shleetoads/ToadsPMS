import { useEffect, useState , useRef } from "react"
import { EquipmentRuntimeData, MachineRuntimeData } from '@/types/vessel/equipmentRuntime'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Search, Edit, Settings, Wrench, Calendar, Minus } from "lucide-react"

interface Props {
  vesselNo: string
}

export default function EquipmentRuntime({ vesselNo }: Props) {
  const [machineRuntimes, setMachineRuntimes] = useState<MachineRuntimeData[]>([])

  const fetchEquipmentRuntimes = (vesselNo: string) => {
    fetch(`/api/ship/equipmentRuntime/all?vesselNo=${vesselNo}`)
      .then(res => res.json())
      .then(data => setMachineRuntimes(data))
      .catch(err => console.error(err))
  }


  useEffect(() => {
    fetchEquipmentRuntimes(vesselNo)
  }, [vesselNo])

  const Odometer = ({ value = 0 }: { value: number }) => {
    const [digits, setDigits] = useState<string[]>([])

    useEffect(() => {
      const totalMinutes = value ?? 0
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60

      const hourStr = hours.toString().padStart(6, "0")
      const minStr = minutes.toString().padStart(2, "0")

      setDigits([hourStr,minStr])
    }, [value])

    return (
    <div className="flex items-end gap-2">
      {/* Hours */}
      <span className="text-2xl font-bold">{digits[0]}</span>
      <span className="text-sm text-gray-500">hr</span>

      {/* Minutes */}
      <span className="text-2xl font-bold ml-2">{digits[1]}</span>
      <span className="text-sm text-gray-500">min</span>
    </div>
    )
  }

  const RuntimeEquipmentTag = ({equipmentData}: {equipmentData: EquipmentRuntimeData}) => {
    type DataProps = {
      runtimeData: EquipmentRuntimeData
      insertHandler: (runtime: number) => void
      closeHandler: () => void
    }

    const [ isEdit , setIsEdit ] = useState(false)

    const insertHandler = (runtime : number) =>{
      handleInsert(runtime)
      
      fetchEquipmentRuntimes(vesselNo)
    }
    
    const handleInsert = async (runtime : number) => {
      const insertedData = {
        vesselNo: equipmentData.vessel_no,
        equipNo: equipmentData.equip_no,
        machineName: equipmentData.machine_name,
        runtime: runtime,
      };

      const res = await fetch('/api/ship/equipmentRuntime/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertedData),
      });

      const data = await res.json();

      if (data.success) {
        alert("저장이 완료되었습니다.");
      } else {
        alert(data.message);
      }
    }

    const closeHandler = () =>{
      setIsEdit(false)
    }

    const RuntimeEditDialog = ({ runtimeData, insertHandler, closeHandler }: DataProps) =>{
      const [isEditDialogOpen, setIsEditDialogOpen] = useState(true)
      const [inputHour, setInputHour] = useState(0)
      const [inputMin, setInputMin] = useState(0)

      const OnDialogOpen = (open : boolean) => {
        setIsEditDialogOpen(open)
        if (!open) {
          closeHandler()
        }
      }
      
      const OnInsertData = (runtime : number) => {
        insertHandler(runtime)
        closeHandler()
      }

      return(
        <Dialog open={isEditDialogOpen} onOpenChange={OnDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{runtimeData.equip_name} 운전 시간 입력</DialogTitle>
                  <DialogDescription>장비의 운전 시간를 입력하세요</DialogDescription>
                </DialogHeader>
                <div className="flex items-end gap-2">
                  <input
                    className="w-60 h-12 text-center border rounded"
                    type="number"
                    onChange={(e) => {
                      if (e.target.value.length > 6) {
                        e.target.value = e.target.value.slice(0, 6)
                      }
                      setInputHour(Number(e.target.value))
                    }}
                  />
                  <span className="text-center"> hr </span>
                  <input
                    className="w-20 h-12 text-center border rounded"
                    type="number"
                    onChange={(e) => {
                      if (e.target.value.length > 2) {
                        e.target.value = e.target.value.slice(0, 2)
                      }
                      setInputMin(Number(e.target.value))
                    }}
                  />
                  <span>min</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => closeHandler()} style={{cursor: 'pointer'}}> 취소 </Button>
                  <Button onClick={() => OnInsertData(inputHour * 60 + inputMin)}> 수정 </Button>
                </div>
              </DialogContent>
            </Dialog>
      )
    }

    const formatDateKST = (date?: string) => {
      if (!date) return "0000-00-00 00:00"

      return new Date(date)
        .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
        .slice(0, 16) + " (KST)"
    }

    return (
      <div>
        <Card
          key={equipmentData.equip_no}
          className="hover:shadow-lg transition-shadow h-full min-w-[320px]"
          onClick={() => setIsEdit(true)}
          >
          <CardHeader>
            <CardTitle className="text-lg truncate">
              {equipmentData.equip_name}
            </CardTitle>
            <CardDescription>
              {equipmentData.machine_name}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <Odometer value={equipmentData.runtime ?? 0} />

            <span className="text-gray-500 text-sm">
              Last Update : {formatDateKST(equipmentData.upload_date)}
            </span>
          </CardContent>
        </Card>

        {isEdit && 
          <RuntimeEditDialog 
            runtimeData={equipmentData} 
            insertHandler={(runtime)=>{insertHandler(runtime)}}
            closeHandler={()=>{closeHandler()}}
          />}
      </div>
    )
  }

  const RuntimeMachineTag = ({ machineData }: { machineData: MachineRuntimeData }) => {
    const [isOpen, setIsOpen] = useState(false)
    
    return (
      <div className="rounded-lg border p-3">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div
            className="flex cursor-pointer items-center justify-between"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <p className="font-semibold">
              {machineData.machine_name} ({machineData.equipment_runtime_datas.length})
            </p>
            <span className="text-sm text-gray-500">
              {isOpen ? (
                <Minus />
              ) : (
                <Plus />
              )}
            </span>
          </div>

          <CollapsibleContent className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {machineData.equipment_runtime_datas.map((equipmentData) => (
              <RuntimeEquipmentTag equipmentData={equipmentData}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    )
  }

  const RuntimeTag = ({machineDatas}: {machineDatas: MachineRuntimeData[]}) =>{
    return(
      <div>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">장비 운전 시간 관리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {machineDatas.map((machineData) => (
              <RuntimeMachineTag machineData={machineData} />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <RuntimeTag machineDatas={machineRuntimes} />
    </div>
  )
}