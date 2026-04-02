import { UsedParts } from './used_parts';

export interface MaintenanceWork {
    work_order: number;
    work_date: string;
    vessel_no: string;
    equip_no: string;
    section_code: string;
    plan_code: string;
    plan_date: string;
    manager: string;
    work_details: string;
    work_hours: number;
    delay_reason: string;
    due_date: string;
    extension_date: string;
    used_parts: UsedParts[];
    used_partnames: string;
    regist_date: string;
    regist_user: string;
    modify_date: string;
    modify_user: string;
    lastest_run_hour?: number;
}