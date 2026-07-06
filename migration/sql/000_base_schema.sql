-- 000_base_schema.sql (생성 스냅샷)
-- ToadsDocument 스키마 전체(49T + T-SQL shim 함수). RDS pg_dump --schema-only 결과.
-- 수동 PG 설치/신규 선박 온보딩 재현용. 적용 순서: 000 → 011 → 012 → 014.
-- 재생성: pg_dump -h <rds> -U postgres -d toadsdocument --schema-only --no-owner --no-privileges

--
-- PostgreSQL database dump
--

\restrict vBNMRfceQ96lbch93zRdcxbfyWBEMkSX0JIBq9X5DXy3WAj6MUDcvHZ7aat1Cgm

-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: fn_get_code_name(character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_code_name(p_code_class character varying, p_code character varying, p_lang character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_name varchar(50);
BEGIN
    SELECT CASE COALESCE(p_lang, 'ko') WHEN 'ko' THEN name ELSE ename END
      INTO v_name
      FROM common_code
     WHERE code_class = p_code_class
       AND code = p_code;

    RETURN COALESCE(v_name, '');
END;
$$;


--
-- Name: fn_get_maintenance_extension(character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_maintenance_extension(p_vessel_no character varying, p_equip_no character varying, p_section_code character varying, p_plan_code character varying) RETURNS timestamp without time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_result_extension_date timestamp;
BEGIN
    SELECT max(extension_date)
      INTO v_result_extension_date
      FROM maintenance_extension
     WHERE vessel_no = p_vessel_no
       AND equip_no = p_equip_no
       AND section_code = p_section_code
       AND plan_code = p_plan_code;

    RETURN v_result_extension_date;
END;
$$;


--
-- Name: fn_get_material_type(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_material_type(p_type_name character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_code varchar(50);
BEGIN
    SELECT code
      INTO v_code
      FROM material_type
     WHERE (code = rtrim(p_type_name) OR name = rtrim(p_type_name))
       AND use_yn = 'Y'
     LIMIT 1;

    RETURN COALESCE(v_code, '');
END;
$$;


--
-- Name: fn_get_material_unit(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_material_unit(p_unit_name character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_code varchar(50);
BEGIN
    SELECT code
      INTO v_code
      FROM material_unit
     WHERE name = rtrim(p_unit_name)
       AND use_yn = 'Y'
     LIMIT 1;

    RETURN COALESCE(v_code, '');
END;
$$;


--
-- Name: fn_get_position(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_position(p_pos_no integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_name varchar(50);
BEGIN
    SELECT pos_ename
      INTO v_name
      FROM position
     WHERE pos_no = p_pos_no;

    RETURN COALESCE(v_name, '');
END;
$$;


--
-- Name: fn_get_user(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_user(p_account_no integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_name varchar(50);
BEGIN
    SELECT user_name
      INTO v_name
      FROM "user"
     WHERE account_no = p_account_no;

    RETURN COALESCE(v_name, '');
END;
$$;


--
-- Name: usp_upsert_equipment_runtime(character varying, character varying, character varying, character varying, integer, timestamp without time zone); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.usp_upsert_equipment_runtime(IN p_vessel_no character varying, IN p_machine_name character varying, IN p_equip_no character varying, IN p_equip_name character varying, IN p_runtime integer, IN p_upload_date timestamp without time zone DEFAULT NULL::timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_upload_date timestamp;
    v_today date;
BEGIN
    IF p_upload_date IS NULL THEN
        v_upload_date := timezone('UTC', now());
    ELSE
        v_upload_date := p_upload_date;
    END IF;

    v_today := v_upload_date::date;

    INSERT INTO equipment_runtime (
        vessel_no,
        machine_name,
        equip_no,
        equip_name,
        lastest_upload_date,
        lastest_runtime,
        prev_upload_date,
        prev_runtime
    )
    VALUES (
        p_vessel_no,
        p_machine_name,
        p_equip_no,
        p_equip_name,
        v_upload_date,
        p_runtime,
        NULL,
        NULL
    )
    ON CONFLICT (vessel_no, machine_name, equip_no)
    DO UPDATE SET
        equip_name = EXCLUDED.equip_name,
        prev_upload_date = CASE
            WHEN equipment_runtime.lastest_upload_date::date = v_today
                THEN equipment_runtime.prev_upload_date
            ELSE equipment_runtime.lastest_upload_date
        END,
        prev_runtime = CASE
            WHEN equipment_runtime.lastest_upload_date::date = v_today
                THEN equipment_runtime.prev_runtime
            ELSE equipment_runtime.lastest_runtime
        END,
        lastest_upload_date = v_upload_date,
        lastest_runtime = p_runtime;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: common_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.common_code (
    code_class character varying(20) NOT NULL,
    code character varying(6) NOT NULL,
    name character varying(50),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    sort_no integer,
    use_yn character varying(1),
    ename character varying(100) DEFAULT ''::character varying
);


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    document_no character varying(20) NOT NULL,
    sdocument_no integer,
    document_name character varying(100),
    ship_no character varying(20),
    writer integer,
    write_date timestamp without time zone,
    file_path character varying(500),
    complete_date timestamp without time zone,
    document_state character varying(3),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    send_date timestamp without time zone,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    expire_date timestamp without time zone
);


--
-- Name: document_approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_approval (
    document_no character varying(20) NOT NULL,
    approval_no integer NOT NULL,
    approval_applicant integer,
    approval_reqdate timestamp without time zone,
    approval_state character varying(3),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    continue_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: document_approval_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_approval_person (
    document_no character varying(20) NOT NULL,
    approval_no integer NOT NULL,
    approval_seq integer NOT NULL,
    approval_person integer,
    final_decision_possible character varying(1),
    final_decision_yn character varying(1),
    approval_date timestamp without time zone,
    approval_state character varying(3),
    reject_reason character varying(500),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    complete_comment character varying(500),
    use_sign character varying(1) DEFAULT 'N'::character varying
);


--
-- Name: document_cell_dimension; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_cell_dimension (
    document_no character varying(20) NOT NULL,
    item_key character varying(100) NOT NULL,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: document_contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_contents (
    document_no character varying(20) NOT NULL,
    item_key character varying(100) NOT NULL,
    item_value character varying(500),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: document_delete_cell; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_delete_cell (
    document_no character varying(20) NOT NULL,
    item_key character varying(100) NOT NULL,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: document_delete_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_delete_row (
    document_no character varying(20) NOT NULL,
    item_key character varying(100) NOT NULL,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: document_merge_cell; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_merge_cell (
    document_no character varying(20) NOT NULL,
    item_key character varying(100) NOT NULL,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: document_table_cell; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_table_cell (
    document_no character varying(20) NOT NULL,
    item_key character varying(100) NOT NULL,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: document_verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_verification (
    document_no character varying(20) NOT NULL,
    account_no integer NOT NULL,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    equip_name character varying(200),
    manufacturer character varying(100),
    model character varying(50),
    specifications character varying(100),
    description character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    category character varying(50),
    lastest_date date,
    machine_name character varying(100) NOT NULL,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);


--
-- Name: equipment_runtime; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_runtime (
    vessel_no character varying(20) NOT NULL,
    machine_name character varying(100) NOT NULL,
    equip_no character varying(50) NOT NULL,
    equip_name character varying(200),
    lastest_upload_date timestamp without time zone,
    lastest_runtime integer,
    prev_upload_date timestamp without time zone,
    prev_runtime integer
);


--
-- Name: external_api_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_api_key (
    api_key_no integer NOT NULL,
    key_name character varying(200) NOT NULL,
    key_prefix character varying(24) NOT NULL,
    key_hash character varying(64) NOT NULL,
    use_yn character(1) DEFAULT 'Y'::bpchar NOT NULL,
    expires_at timestamp without time zone,
    last_used_at timestamp without time zone,
    regist_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    regist_user character varying(50),
    modify_date timestamp without time zone,
    modify_user character varying(50),
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: TABLE external_api_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.external_api_key IS '외부 시스템 연동용 API KEY (평문은 DB에 저장하지 않음)';


--
-- Name: COLUMN external_api_key.key_prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.external_api_key.key_prefix IS '목록 표시용 키 앞부분 (예: tdoc_abcd1234...)';


--
-- Name: COLUMN external_api_key.key_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.external_api_key.key_hash IS 'SHA-256(pepper + api_key) hex';


--
-- Name: external_api_key_api_key_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_api_key_api_key_no_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_api_key_api_key_no_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_api_key_api_key_no_seq OWNED BY public.external_api_key.api_key_no;


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    file_no integer NOT NULL,
    file_name character varying(100),
    file_path character varying(500),
    file_name_ext character varying(100),
    origin_file_name character varying(100),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    use_file_read character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: files_file_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.files ALTER COLUMN file_no ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.files_file_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: files_read; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files_read (
    files_read_no integer NOT NULL,
    files_no integer NOT NULL,
    account_no integer NOT NULL,
    file_read_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    send_date timestamp without time zone,
    CONSTRAINT ck_files_read_delete_yn CHECK (((delete_yn = 'N'::bpchar) OR (delete_yn = 'Y'::bpchar))),
    CONSTRAINT ck_files_read_file_read_yn CHECK (((file_read_yn = 'N'::bpchar) OR (file_read_yn = 'Y'::bpchar)))
);


--
-- Name: files_read_files_read_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.files_read ALTER COLUMN files_read_no ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.files_read_files_read_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: input_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.input_type (
    type character varying(4) NOT NULL,
    description character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);


--
-- Name: input_type_pattern; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.input_type_pattern (
    type character varying(4) NOT NULL,
    seq integer NOT NULL,
    pattern character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);


--
-- Name: loss; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loss (
    vessel_no character varying(20) NOT NULL,
    loss_no character varying(20) NOT NULL,
    material_code character varying(30),
    loss_date date,
    loss_unit character varying(10),
    loss_qty integer,
    loss_location character varying(20),
    loss_reason character varying(200),
    loss_remark character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    loss_type character varying(2),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);


--
-- Name: machine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine (
    vessel_no character varying(20) NOT NULL,
    machine_name character varying(100) NOT NULL,
    manufacturer character varying(100),
    machine_desc character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    sort_no integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);


--
-- Name: maintenance_extension; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_extension (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    plan_code character varying(10) NOT NULL,
    extension_seq integer NOT NULL,
    extension_date timestamp without time zone,
    extension_reason character varying(500),
    request_date timestamp without time zone,
    applicant integer,
    approval_status character varying(10),
    approval_date timestamp without time zone,
    approver integer,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    approval_reason character varying(200)
);


--
-- Name: maintenance_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_plan (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    plan_code character varying(10) NOT NULL,
    plan_name character varying(200),
    manufacturer character varying(100),
    model character varying(50),
    specifications character varying(100),
    lastest_date date,
    workers integer,
    work_hours integer,
    "interval" integer,
    interval_term character varying(10),
    location character varying(1),
    self_maintenance character varying(1),
    manager character varying(100),
    important_items character varying(1),
    instructions character varying(500),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    critical character varying(10),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    prev_pms_code character varying(20),
    lastest_run_hour integer
);


--
-- Name: maintenance_work; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_work (
    vessel_no character varying(20) NOT NULL,
    work_order integer NOT NULL,
    work_date date,
    manager character varying(100),
    work_details character varying(500),
    used_parts character varying(200),
    work_hours integer,
    delay_reason character varying(500),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    plan_code character varying(10) NOT NULL,
    plan_date timestamp without time zone,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    lastest_run_hour integer
);


--
-- Name: material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material (
    vessel_no character varying(20) NOT NULL,
    material_code character varying(30) NOT NULL,
    material_name character varying(200),
    material_group character varying(100),
    material_spec character varying(200),
    material_type character varying(100),
    material_unit character varying(10),
    drawing_no character varying(50),
    machine_name character varying(20),
    standard_qty integer,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    warehouse_no character varying(20)
);


--
-- Name: material_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_type (
    code character varying(5) NOT NULL,
    name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);


--
-- Name: material_unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_unit (
    code character varying(5) NOT NULL,
    name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    notification_id bigint NOT NULL,
    target_type character varying(50) DEFAULT NULL::character varying,
    account_no integer,
    document_no character varying(20) DEFAULT NULL::character varying,
    sdocument_no integer,
    ship_no character varying(20) DEFAULT NULL::character varying,
    regist_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    regist_user integer,
    alarm_code character varying(20) DEFAULT NULL::character varying
);


--
-- Name: notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notification ALTER COLUMN notification_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.notification_notification_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notification_read; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_read (
    notification_read_id bigint NOT NULL,
    notification_id bigint NOT NULL,
    account_no integer,
    read_date timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notification_read_notification_read_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notification_read ALTER COLUMN notification_read_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.notification_read_notification_read_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: position; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."position" (
    pos_no integer NOT NULL,
    pos_code character varying(10) NOT NULL,
    pos_name character varying(100),
    pos_ename character varying(100),
    pos_part character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: receive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receive (
    vessel_no character varying(20) NOT NULL,
    receive_no character varying(20) NOT NULL,
    material_code character varying(30),
    receive_date date,
    receive_type character varying(2),
    receive_unit character varying(10),
    receive_qty integer,
    receive_location character varying(20),
    receive_remark character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    receive_reason character varying(200),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    delivery_location character varying(100)
);


--
-- Name: release; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release (
    vessel_no character varying(20) NOT NULL,
    release_no character varying(20) NOT NULL,
    material_code character varying(30),
    release_date date,
    release_type character varying(2),
    release_unit character varying(10),
    release_qty integer,
    release_location character varying(20),
    work_order integer,
    part_seq integer,
    release_remark character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    release_reason character varying(200),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);


--
-- Name: section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section (
    vessel_no character varying(20) NOT NULL,
    equip_no character varying(10) NOT NULL,
    section_code character varying(10) NOT NULL,
    section_name character varying(200),
    description character varying(200),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);


--
-- Name: sentence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sentence (
    sen_no integer NOT NULL,
    sen_count integer DEFAULT 0 NOT NULL,
    sen_content character varying(1000),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: sentence_sen_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sentence ALTER COLUMN sen_no ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sentence_sen_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: standard_approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_approval (
    sapproval_no integer NOT NULL,
    sapproval_name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: standard_approval_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_approval_person (
    sapproval_no integer NOT NULL,
    sapproval_seq integer NOT NULL,
    sapproval_person integer,
    final_decision_possible character varying(1),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: standard_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_document (
    sdocument_no integer NOT NULL,
    sdocument_name character varying(100),
    file_path character varying(500),
    file_name character varying(100),
    origin_file_name character varying(100),
    json_name character varying(100),
    distribution_date timestamp without time zone,
    ship_use_yn character varying(1),
    sdocument_state character varying(3),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    user_document_no character varying(200),
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    expire_year integer
);


--
-- Name: standard_document_delete_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_document_delete_row (
    sdocument_no integer NOT NULL,
    item_key character varying(10),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: standard_document_position; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_document_position (
    sdocument_no integer NOT NULL,
    pos_no integer NOT NULL,
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    send_date timestamp without time zone
);


--
-- Name: sync_image; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_image (
    sync_image_id bigint NOT NULL,
    ship_no character varying(20) DEFAULT NULL::character varying,
    file_name character varying(100) DEFAULT NULL::character varying,
    file_size integer,
    send_bytes integer,
    regist_date timestamp without time zone,
    send_date timestamp without time zone,
    recieve_date timestamp without time zone,
    sync_status character varying(20) DEFAULT NULL::character varying
);


--
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    tenant_no integer NOT NULL,
    tenant_name character varying(100),
    owner_name character varying(100),
    business_no character varying(20),
    resident_no character varying(30),
    business_place character varying(200),
    nation character varying(3),
    telephone character varying(20),
    email character varying(50),
    domain_addr character varying(30),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character varying(1) DEFAULT 'N'::character varying
);


--
-- Name: tenant_tenant_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tenant ALTER COLUMN tenant_no ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tenant_tenant_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: used_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.used_parts (
    vessel_no character varying(20) NOT NULL,
    work_order integer NOT NULL,
    part_seq integer NOT NULL,
    warehouse_no character varying(20),
    material_code character varying(20),
    use_unit character varying(10),
    use_qty integer,
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    account_no integer NOT NULL,
    user_name character varying(50),
    user_ename character varying(50),
    email character varying(50),
    password bytea,
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    ship_no character varying(20),
    "position" integer,
    user_auth character varying(6),
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    tenant_no integer
);


--
-- Name: user_approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_approval (
    account_no integer NOT NULL,
    approval_no integer NOT NULL,
    approval_name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);


--
-- Name: user_approval_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_approval_person (
    account_no integer NOT NULL,
    approval_no integer NOT NULL,
    approval_seq integer NOT NULL,
    approval_person integer,
    final_decision_possible character varying(1),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer
);


--
-- Name: user_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_code (
    code_no integer NOT NULL,
    code_name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: user_code_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_code_item (
    code_no integer NOT NULL,
    item_seq integer NOT NULL,
    item_desc character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL
);


--
-- Name: user_sign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sign (
    account_no integer NOT NULL,
    sign_type character varying(5) NOT NULL,
    file_path character varying(500),
    file_name character varying(100),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    send_date timestamp without time zone
);


--
-- Name: vessel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel (
    vessel_no character varying(20) NOT NULL,
    vessel_name character varying(100) NOT NULL,
    imo_no character varying(20),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    vessel_short_name character varying(20),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone,
    delete_yn character(1) DEFAULT 'N'::bpchar NOT NULL,
    vessel_stamp_path character varying(500),
    vessel_stamp_name character varying(100)
);


--
-- Name: warehouse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse (
    vessel_no character varying(20) NOT NULL,
    warehouse_no character varying(20) NOT NULL,
    warehouse_name character varying(100),
    warehouse_desc character varying(200),
    use_yn character varying(1),
    regist_date timestamp without time zone,
    regist_user integer,
    modify_date timestamp without time zone,
    modify_user integer,
    warehouse_location character varying(100),
    last_send_date timestamp without time zone,
    last_receive_date timestamp without time zone
);


--
-- Name: external_api_key api_key_no; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_api_key ALTER COLUMN api_key_no SET DEFAULT nextval('public.external_api_key_api_key_no_seq'::regclass);


--
-- Name: external_api_key external_api_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_api_key
    ADD CONSTRAINT external_api_key_pkey PRIMARY KEY (api_key_no);


--
-- Name: common_code pk_common_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.common_code
    ADD CONSTRAINT pk_common_code PRIMARY KEY (code_class, code);


--
-- Name: document pk_document; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT pk_document PRIMARY KEY (document_no);


--
-- Name: document_approval pk_document_approval; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approval
    ADD CONSTRAINT pk_document_approval PRIMARY KEY (document_no, approval_no);


--
-- Name: document_approval_person pk_document_approval_person; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approval_person
    ADD CONSTRAINT pk_document_approval_person PRIMARY KEY (document_no, approval_no, approval_seq);


--
-- Name: document_cell_dimension pk_document_cell_dimension; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_cell_dimension
    ADD CONSTRAINT pk_document_cell_dimension PRIMARY KEY (document_no, item_key);


--
-- Name: document_contents pk_document_contents; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_contents
    ADD CONSTRAINT pk_document_contents PRIMARY KEY (document_no, item_key);


--
-- Name: document_delete_cell pk_document_delete_cell; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_delete_cell
    ADD CONSTRAINT pk_document_delete_cell PRIMARY KEY (document_no, item_key);


--
-- Name: document_delete_row pk_document_delete_row; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_delete_row
    ADD CONSTRAINT pk_document_delete_row PRIMARY KEY (document_no, item_key);


--
-- Name: document_merge_cell pk_document_merge_cell; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_merge_cell
    ADD CONSTRAINT pk_document_merge_cell PRIMARY KEY (document_no, item_key);


--
-- Name: document_table_cell pk_document_table_cell; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_table_cell
    ADD CONSTRAINT pk_document_table_cell PRIMARY KEY (document_no, item_key);


--
-- Name: document_verification pk_document_verification; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verification
    ADD CONSTRAINT pk_document_verification PRIMARY KEY (document_no, account_no);


--
-- Name: user_code pk_dropdown; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_code
    ADD CONSTRAINT pk_dropdown PRIMARY KEY (code_no);


--
-- Name: user_code_item pk_dropdown_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_code_item
    ADD CONSTRAINT pk_dropdown_item PRIMARY KEY (code_no, item_seq);


--
-- Name: equipment pk_equipment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT pk_equipment PRIMARY KEY (equip_no, vessel_no, machine_name);


--
-- Name: equipment_runtime pk_equipment_runtime; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_runtime
    ADD CONSTRAINT pk_equipment_runtime PRIMARY KEY (vessel_no, machine_name, equip_no);


--
-- Name: files pk_files; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT pk_files PRIMARY KEY (file_no);


--
-- Name: files_read pk_files_read; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files_read
    ADD CONSTRAINT pk_files_read PRIMARY KEY (files_read_no);


--
-- Name: input_type pk_input_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.input_type
    ADD CONSTRAINT pk_input_type PRIMARY KEY (type);


--
-- Name: input_type_pattern pk_input_type_pattern; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.input_type_pattern
    ADD CONSTRAINT pk_input_type_pattern PRIMARY KEY (type, seq);


--
-- Name: loss pk_loss; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss
    ADD CONSTRAINT pk_loss PRIMARY KEY (vessel_no, loss_no);


--
-- Name: machine pk_machine; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine
    ADD CONSTRAINT pk_machine PRIMARY KEY (vessel_no, machine_name);


--
-- Name: maintenance_extension pk_maintenance_extension; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_extension
    ADD CONSTRAINT pk_maintenance_extension PRIMARY KEY (equip_no, section_code, plan_code, vessel_no, extension_seq);


--
-- Name: maintenance_plan pk_maintenance_plan; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_plan
    ADD CONSTRAINT pk_maintenance_plan PRIMARY KEY (equip_no, section_code, plan_code, vessel_no);


--
-- Name: maintenance_work pk_maintenance_work; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work
    ADD CONSTRAINT pk_maintenance_work PRIMARY KEY (vessel_no, work_order);


--
-- Name: material pk_material; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material
    ADD CONSTRAINT pk_material PRIMARY KEY (vessel_no, material_code);


--
-- Name: warehouse pk_material_location; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT pk_material_location PRIMARY KEY (vessel_no, warehouse_no);


--
-- Name: material_type pk_material_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_type
    ADD CONSTRAINT pk_material_type PRIMARY KEY (code);


--
-- Name: material_unit pk_material_unit; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_unit
    ADD CONSTRAINT pk_material_unit PRIMARY KEY (code);


--
-- Name: notification pk_notification; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT pk_notification PRIMARY KEY (notification_id);


--
-- Name: notification_read pk_notification_read; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_read
    ADD CONSTRAINT pk_notification_read PRIMARY KEY (notification_read_id);


--
-- Name: position pk_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT pk_position PRIMARY KEY (pos_no);


--
-- Name: release pk_release; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release
    ADD CONSTRAINT pk_release PRIMARY KEY (vessel_no, release_no);


--
-- Name: section pk_section; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section
    ADD CONSTRAINT pk_section PRIMARY KEY (equip_no, section_code, vessel_no);


--
-- Name: sentence pk_sentence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sentence
    ADD CONSTRAINT pk_sentence PRIMARY KEY (sen_no);


--
-- Name: standard_approval pk_standard_approval; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_approval
    ADD CONSTRAINT pk_standard_approval PRIMARY KEY (sapproval_no);


--
-- Name: standard_approval_person pk_standard_approval_person; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_approval_person
    ADD CONSTRAINT pk_standard_approval_person PRIMARY KEY (sapproval_no, sapproval_seq);


--
-- Name: standard_document pk_standard_document; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_document
    ADD CONSTRAINT pk_standard_document PRIMARY KEY (sdocument_no);


--
-- Name: standard_document_delete_row pk_standard_document_delete_row; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_document_delete_row
    ADD CONSTRAINT pk_standard_document_delete_row PRIMARY KEY (sdocument_no);


--
-- Name: standard_document_position pk_standard_document_position_1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_document_position
    ADD CONSTRAINT pk_standard_document_position_1 PRIMARY KEY (sdocument_no, pos_no);


--
-- Name: sync_image pk_sync_image; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_image
    ADD CONSTRAINT pk_sync_image PRIMARY KEY (sync_image_id);


--
-- Name: tenant pk_tenant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT pk_tenant PRIMARY KEY (tenant_no);


--
-- Name: used_parts pk_used_parts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.used_parts
    ADD CONSTRAINT pk_used_parts PRIMARY KEY (vessel_no, work_order, part_seq);


--
-- Name: user pk_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT pk_user PRIMARY KEY (account_no);


--
-- Name: user_approval pk_user_approval; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_approval
    ADD CONSTRAINT pk_user_approval PRIMARY KEY (account_no, approval_no);


--
-- Name: user_approval_person pk_user_approval_person; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_approval_person
    ADD CONSTRAINT pk_user_approval_person PRIMARY KEY (account_no, approval_no, approval_seq);


--
-- Name: user_sign pk_user_sign; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sign
    ADD CONSTRAINT pk_user_sign PRIMARY KEY (account_no, sign_type);


--
-- Name: vessel pk_vessel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel
    ADD CONSTRAINT pk_vessel PRIMARY KEY (vessel_no);


--
-- Name: receive pk_warehouse; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receive
    ADD CONSTRAINT pk_warehouse PRIMARY KEY (receive_no, vessel_no);


--
-- Name: idx_external_api_key_hash_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_api_key_hash_active ON public.external_api_key USING btree (key_hash) WHERE ((delete_yn = 'N'::bpchar) AND (use_yn = 'Y'::bpchar));


--
-- Name: maintenance_extension fk_maintenance_extension; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_extension
    ADD CONSTRAINT fk_maintenance_extension FOREIGN KEY (equip_no, section_code, plan_code, vessel_no) REFERENCES public.maintenance_plan(equip_no, section_code, plan_code, vessel_no);


--
-- Name: maintenance_plan fk_maintenance_plan_section; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_plan
    ADD CONSTRAINT fk_maintenance_plan_section FOREIGN KEY (equip_no, section_code, vessel_no) REFERENCES public.section(equip_no, section_code, vessel_no);


--
-- Name: maintenance_work fk_maintenance_work_maintenance_plan; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_work
    ADD CONSTRAINT fk_maintenance_work_maintenance_plan FOREIGN KEY (equip_no, section_code, plan_code, vessel_no) REFERENCES public.maintenance_plan(equip_no, section_code, plan_code, vessel_no);


--
-- Name: used_parts fk_maintenance_work_used_parts; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.used_parts
    ADD CONSTRAINT fk_maintenance_work_used_parts FOREIGN KEY (vessel_no, work_order) REFERENCES public.maintenance_work(vessel_no, work_order);


--
-- Name: notification_read fk_notification_read_notification; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_read
    ADD CONSTRAINT fk_notification_read_notification FOREIGN KEY (notification_id) REFERENCES public.notification(notification_id) ON DELETE CASCADE;


--
-- Name: user fk_user_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_no) REFERENCES public.tenant(tenant_no);


--
-- Name: release relationship13; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release
    ADD CONSTRAINT relationship13 FOREIGN KEY (vessel_no, material_code) REFERENCES public.material(vessel_no, material_code);


--
-- Name: loss relationship19; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss
    ADD CONSTRAINT relationship19 FOREIGN KEY (vessel_no, material_code) REFERENCES public.material(vessel_no, material_code);


--
-- Name: receive relationship8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receive
    ADD CONSTRAINT relationship8 FOREIGN KEY (vessel_no, material_code) REFERENCES public.material(vessel_no, material_code);


--
-- PostgreSQL database dump complete
--

\unrestrict vBNMRfceQ96lbch93zRdcxbfyWBEMkSX0JIBq9X5DXy3WAj6MUDcvHZ7aat1Cgm

