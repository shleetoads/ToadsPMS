import { useEffect, useState } from "react"

interface Props {
  equip_name: string,
  machine_name: string,
  handleRuntimeChanged: (runtime: number) => void
}

export default function EquipmentRuntimeInput({ equip_name, machine_name, handleRuntimeChanged }: Props) {
  const [hour, setHour] = useState(0)
  const [min, setMin] = useState(0)
  const [runtime, setRuntime] = useState(0)

  useEffect(() => {
    setRuntime(hour * 60 + min)  
  }, [hour,min])

  useEffect(() =>{
    handleRuntimeChanged(runtime)
  },[runtime])

  return(
  <div>
    <div>
      <p className="text-xs mb-2">{equip_name} ({machine_name}) 운전 시간</p>
      <div className="flex items-end gap-2">
        <input
          className="w-60 h-12 text-center border rounded"
          type="number"
          onChange={(e) => {
            if (e.target.value.length > 6) {
              e.target.value = e.target.value.slice(0, 6)
            }
            setHour(Number(e.target.value))
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
            setMin(Number(e.target.value))
          }}
        />
        <span>min</span>
      </div>
    </div>
  </div>
  )
}
