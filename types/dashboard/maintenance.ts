import { UsedParts } from '@/types/vessel/used_parts';

export interface Maintenance {
    vessel_no: string;
    vessel_name: string;
    equip_no: string;
    equip_name: string;
    machine_name: string;
    category: string;
    section_code?: string;
    section_name?: string;
    plan_code?: string;
    plan_name?: string;
    manufacturer?: string;
    model?: string;
    specifications?: string;
    lastest_date?: string;
    workers?: number;
    work_hours?: number;
    interval?: number;
    interval_term?: string;
    location?: string;
    self_maintenance?: string;
    manager?: string;
    critical?: string;
    due_date?: string;
    next_due_date?: string;
    extension_date?: string
    status?: string;
    days_until?: number;
    extension_days_until?: number;
    work_details?: string;
    delay_reason?: string;
    children: Maintenance[];
    used_parts?: UsedParts[];
    used_partnames?: string;
    type?: string;
    regist_date?: string;
    regist_user?: string;
    modify_date?: string;
    modify_user?: string;

    lastest_run_hour?: number;
    due_run_hour?: number;
    next_due_run_hour?: number;
    diff_per_day?: number;
}