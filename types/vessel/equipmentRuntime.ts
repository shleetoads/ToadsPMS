export interface EquipmentRuntimeData {
    vessel_no: string;
    machine_name: string;
    equip_no: string;
    equip_name: string;
    upload_date: string;
    runtime: number;
}

export interface MachineRuntimeData {
    vessel_no: string;
    machine_name: string;
    equipment_runtime_datas: EquipmentRuntimeData[];
}