import { Maintenance } from "@/types/calendar/maintenance";
import { Equipment } from "@/types/vessel/equipment";
import { Machine } from "@/types/vessel/machine";
import { Section } from "@/types/vessel/section";
import { useEffect, useState } from "react";



interface Props {
  vesselNoProps: string,
  machinesProps: Machine[],
  equipmentsProps: Equipment[],
  sectionsProps: Section[],
  tasksProps: Maintenance[]
}

export default function TaskList({ 
  vesselNoProps, 
  machinesProps,
  equipmentsProps,
  sectionsProps,
  tasksProps
}: Props) {

  const [vesselNo, setVesselNo] = useState<string>('')
  const [machines, setMachines] = useState<Machine[]>([])
  const [equipments, setEquipements] = useState<Equipment[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [tasks, setTasks] = useState<Maintenance[]>([])

  useEffect(() => {
    setVesselNo(vesselNoProps)
    setMachines(machinesProps)
    setEquipements(equipmentsProps)
    setSections(sectionsProps)
    setTasks(tasksProps)
  }, [
    vesselNoProps,
    machinesProps,
    equipmentsProps,
    sectionsProps,
    tasksProps
  ])

  const TaskList = () => {
    return(
      <div>
        {tasks.map((task) => (
          <p>task.plan_name</p>
        ))}
      </div>
    )
  }

  const SectionList = () => {
    return(
      {TaskList}
    )

  }

  const EquipmentList = () => {
    return(
      {SectionList}
    )

  }

  const MachineList = () => {
    return(
      {EquipmentList}
    )

  }

  const VesselList = () => {
    return(
      {MachineList}
    )
  }

  return(
    <div>
      {/* {VesselList} */}
    </div>
  )
}