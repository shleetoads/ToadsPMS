export interface MaintenanceExtension {
    vessel_no: string;
    equip_no: string;
    section_code: string;
    plan_code: string;
    plan_name: string;
    manager: string;
    due_date: string;
    extension_seq?: string;
    extension_date?: string;
    extension_reason?: string;
    request_date?: string;
    applicant?: string;
    approval_status?: string;
    approval_date?: string;
    approver?: string;
    approval_reason?: string;
    next_due_date?: string;
    regist_date?: string;
    regist_user?: string;
    modify_date?: string;
    modify_user?: string;
    due_run_hour?: number;
    next_due_run_hour?: number;
}