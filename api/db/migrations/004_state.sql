-- The state of every employee on a date (D47): for each field, the latest non-cancelled change
-- dated on or before `as_of` (same date: the later-entered change wins). Changes after a person's
-- leave date don't apply. People hired after `as_of` have no row.
CREATE FUNCTION employee_state(as_of date)
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
    AND c.effective_date <= as_of
    AND (e.leave_date IS NULL OR c.effective_date <= e.leave_date)
  GROUP BY c.employee_id
$$;
