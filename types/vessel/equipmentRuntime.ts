export interface MachineRuntimeData {
    vessel_no: string;
    machine_name: string;
    equipment_runtime_datas: EquipmentRuntimeData[];
}

export interface EquipmentRuntimeData {
    vessel_no: string;
    machine_name: string;
    equip_no: string;
    equip_name: string;
    lastest_upload_date: string;
    lastest_runtime: number;
    prev_upload_date: string;
    prev_runtime: number;
    diff_per_day:number;
    estimated_runtime_today: number;
}