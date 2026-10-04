-- Employee list: accent- and case-insensitive substring search, and "current" state.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() isn't IMMUTABLE (it depends on a dictionary setting); pin the dictionary so it can be indexed.
-- Postgres 17 evaluates index expressions with a safe search_path, so names are schema-qualified.
CREATE FUNCTION f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE FUNCTION employee_search_text(first_name text, last_name text, work_email text, code text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT public.f_unaccent(lower(first_name || ' ' || last_name || ' ' || work_email || ' ' || code)) $$;

CREATE INDEX employees_search ON employees USING gin (employee_search_text(first_name, last_name, work_email, code) gin_trgm_ops);

-- Each person's state today, or on their hire date if they haven't started yet.
CREATE FUNCTION current_state(today date)
RETURNS TABLE (employee_id int, country text, currency text, department text, role text, level smallint, manager_id int, salary bigint)
LANGUAGE sql STABLE AS $$
  SELECT c.employee_id,
    (array_agg(c.country    ORDER BY c.effective_date DESC, c.id DESC) FILTER (WHERE c.country IS NOT NULL))[1],
    (array_agg(c.currency   ORDER BY c.effective_date DESC, c.id DESC) FILTER (WHERE c.salary IS NOT NULL))[1],
    (array_agg(c.department ORDER BY c.effective_date DESC, c.id DESC) FILTER (WHERE c.department IS NOT NULL))[1],
    (array_agg(c.role       ORDER BY c.effective_date DESC, c.id DESC) FILTER (WHERE c.role IS NOT NULL))[1],
    (array_agg(c.level      ORDER BY c.effective_date DESC, c.id DESC) FILTER (WHERE c.level IS NOT NULL))[1],
    (array_agg(c.manager_id ORDER BY c.effective_date DESC, c.id DESC) FILTER (WHERE c.manager_set))[1],
    (array_agg(c.salary     ORDER BY c.effective_date DESC, c.id DESC) FILTER (WHERE c.salary IS NOT NULL))[1]
  FROM job_changes c
  JOIN employees e ON e.id = c.employee_id
  WHERE c.cancelled_at IS NULL
    AND c.effective_date <= greatest(today, e.hire_date)
    AND (e.leave_date IS NULL OR c.effective_date <= e.leave_date)
  GROUP BY c.employee_id
$$;
