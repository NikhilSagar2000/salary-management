-- Every change that applies (not cancelled, not after the person's leave date) with the values in force
-- just before it, classified into kinds; plus leave and undo events. Read by the assistant's tools.
CREATE VIEW change_log AS
WITH c AS (
  SELECT c.*,
    c.id = (SELECT min(f.id) FROM job_changes f WHERE f.employee_id = c.employee_id) AS is_hire,
    prev.*
  FROM job_changes c
  JOIN employees e ON e.id = c.employee_id
  CROSS JOIN LATERAL (
    SELECT
      (SELECT p.country FROM job_changes p WHERE p.employee_id = c.employee_id AND p.cancelled_at IS NULL
         AND (p.effective_date, p.id) < (c.effective_date, c.id) AND p.country IS NOT NULL ORDER BY p.effective_date DESC, p.id DESC LIMIT 1) AS prev_country,
      (SELECT p.department FROM job_changes p WHERE p.employee_id = c.employee_id AND p.cancelled_at IS NULL
         AND (p.effective_date, p.id) < (c.effective_date, c.id) AND p.department IS NOT NULL ORDER BY p.effective_date DESC, p.id DESC LIMIT 1) AS prev_department,
      (SELECT p.role FROM job_changes p WHERE p.employee_id = c.employee_id AND p.cancelled_at IS NULL
         AND (p.effective_date, p.id) < (c.effective_date, c.id) AND p.role IS NOT NULL ORDER BY p.effective_date DESC, p.id DESC LIMIT 1) AS prev_role,
      (SELECT p.level FROM job_changes p WHERE p.employee_id = c.employee_id AND p.cancelled_at IS NULL
         AND (p.effective_date, p.id) < (c.effective_date, c.id) AND p.level IS NOT NULL ORDER BY p.effective_date DESC, p.id DESC LIMIT 1) AS prev_level,
      (SELECT p.manager_id FROM job_changes p WHERE p.employee_id = c.employee_id AND p.cancelled_at IS NULL
         AND (p.effective_date, p.id) < (c.effective_date, c.id) AND p.manager_set ORDER BY p.effective_date DESC, p.id DESC LIMIT 1) AS prev_manager_id,
      (SELECT row(p.salary, p.currency)::text FROM job_changes p WHERE p.employee_id = c.employee_id AND p.cancelled_at IS NULL
         AND (p.effective_date, p.id) < (c.effective_date, c.id) AND p.salary IS NOT NULL ORDER BY p.effective_date DESC, p.id DESC LIMIT 1) AS prev_pay
  ) prev
  WHERE c.cancelled_at IS NULL AND (e.leave_date IS NULL OR c.effective_date <= e.leave_date)
), typed AS (
  SELECT c.*,
    split_part(trim(both '()' from c.prev_pay), ',', 1)::bigint AS prev_salary,
    nullif(split_part(trim(both '()' from c.prev_pay), ',', 2), '') AS prev_currency
  FROM c
)
SELECT 'change' AS source, t.id, t.employee_id, t.effective_date AS date, t.note,
  array_remove(ARRAY[
    CASE WHEN t.is_hire THEN 'hire' END,
    CASE WHEN NOT t.is_hire AND t.level > t.prev_level THEN 'promotion' END,
    CASE WHEN NOT t.is_hire AND t.level < t.prev_level THEN 'demotion' END,
    CASE WHEN NOT t.is_hire AND t.salary > t.prev_salary AND t.currency = t.prev_currency THEN 'raise' END,
    CASE WHEN NOT t.is_hire AND t.salary < t.prev_salary AND t.currency = t.prev_currency THEN 'pay_cut' END,
    CASE WHEN NOT t.is_hire AND t.role <> t.prev_role THEN 'role_change' END,
    CASE WHEN NOT t.is_hire AND t.department <> t.prev_department THEN 'department_change' END,
    CASE WHEN NOT t.is_hire AND t.country <> t.prev_country THEN 'relocation' END,
    CASE WHEN NOT t.is_hire AND t.manager_set AND t.manager_id IS DISTINCT FROM t.prev_manager_id THEN 'manager_change' END
  ], NULL) AS kinds,
  t.country, t.prev_country, t.department, t.prev_department, t.role, t.prev_role, t.level, t.prev_level,
  t.manager_set, t.manager_id, t.prev_manager_id, t.salary, t.currency, t.prev_salary, t.prev_currency
FROM typed t
UNION ALL
SELECT 'leave', l.id, l.employee_id, l.leave_date, l.reason,
  ARRAY[CASE l.kind WHEN 'left' THEN 'leave' ELSE 'undo_leave' END],
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL
FROM leave_events l;
