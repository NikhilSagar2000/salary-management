-- Job history: dated changes, each holding only the fields it changes (D47).
-- The state on a date combines non-cancelled changes in date order (same date: higher id wins).
CREATE TABLE job_changes (
  id bigserial PRIMARY KEY,
  employee_id int NOT NULL REFERENCES employees (id),
  effective_date date NOT NULL,
  country text CHECK (country IN ('US', 'IN', 'GB', 'DE', 'BR', 'JP')),
  department text,
  role text,
  level smallint CHECK (level BETWEEN 1 AND 7),
  manager_set boolean NOT NULL DEFAULT false, -- true: this change sets manager_id (NULL = no manager)
  manager_id int REFERENCES employees (id),
  salary bigint CHECK (salary > 0),
  currency text CHECK (currency IN ('USD', 'INR', 'GBP', 'EUR', 'BRL', 'JPY')),
  note text CHECK (length(note) <= 500),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((salary IS NULL) = (currency IS NULL)),
  CHECK (country IS NULL OR salary IS NOT NULL), -- a move needs a salary in the new currency
  CHECK (country IS NULL OR currency = CASE country
    WHEN 'US' THEN 'USD' WHEN 'IN' THEN 'INR' WHEN 'GB' THEN 'GBP'
    WHEN 'DE' THEN 'EUR' WHEN 'BR' THEN 'BRL' WHEN 'JP' THEN 'JPY' END),
  CHECK (manager_set OR manager_id IS NULL),
  CHECK (country IS NOT NULL OR department IS NOT NULL OR role IS NOT NULL OR level IS NOT NULL
    OR manager_set OR salary IS NOT NULL)
);
CREATE INDEX job_changes_employee_date ON job_changes (employee_id, effective_date, id);

CREATE TABLE leave_events (
  id bigserial PRIMARY KEY,
  employee_id int NOT NULL REFERENCES employees (id),
  kind text NOT NULL CHECK (kind IN ('left', 'undone')),
  leave_date date,
  reason text CHECK (length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leave_events_employee ON leave_events (employee_id, id);

CREATE FUNCTION history_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'History can''t be deleted.' USING ERRCODE = 'restrict_violation';
END $$;

CREATE FUNCTION history_no_edit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'History can''t be edited.' USING ERRCODE = 'restrict_violation';
END $$;

-- The one allowed update to a job change: cancelling it, once (the app allows it for scheduled changes only).
CREATE FUNCTION job_changes_only_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL
     AND (to_jsonb(NEW) - 'cancelled_at') = (to_jsonb(OLD) - 'cancelled_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'History can''t be edited.' USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER job_changes_no_edit BEFORE UPDATE ON job_changes FOR EACH ROW EXECUTE FUNCTION job_changes_only_cancel();
CREATE TRIGGER job_changes_no_delete BEFORE DELETE ON job_changes FOR EACH ROW EXECUTE FUNCTION history_no_delete();
CREATE TRIGGER leave_events_no_edit BEFORE UPDATE ON leave_events FOR EACH ROW EXECUTE FUNCTION history_no_edit();
CREATE TRIGGER leave_events_no_delete BEFORE DELETE ON leave_events FOR EACH ROW EXECUTE FUNCTION history_no_delete();

CREATE FUNCTION employees_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Employees can''t be deleted.' USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER employees_no_delete BEFORE DELETE ON employees FOR EACH ROW EXECUTE FUNCTION employees_no_delete();
