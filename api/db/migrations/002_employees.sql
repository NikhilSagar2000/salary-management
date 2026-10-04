-- Employees: identity and personal details. Job and pay live in job_changes.
CREATE TABLE employees (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^E[0-9]{6}$'),
  first_name text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (length(last_name) BETWEEN 1 AND 100),
  gender text NOT NULL CHECK (gender IN ('female', 'male', 'non_binary')),
  work_email text NOT NULL,
  hire_date date NOT NULL,
  leave_date date CHECK (leave_date >= hire_date),
  leave_reason text CHECK (leave_reason IS NULL OR (length(leave_reason) <= 500 AND leave_date IS NOT NULL)),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employees_work_email_key ON employees (lower(work_email));

CREATE FUNCTION employees_keep_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code <> OLD.code OR NEW.hire_date <> OLD.hire_date THEN
    RAISE EXCEPTION 'The employee code and hire date can''t be changed.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employees_keep_identity BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION employees_keep_identity();
