-- Seed Report Periods for 2024-2025
INSERT INTO report_periods (name, period_type, school_year, start_date, end_date, is_active, order_number) VALUES
('Trimestre 1', 'trimester', '2024-2025', '2024-09-01', '2024-12-31', true, 1),
('Trimestre 2', 'trimester', '2024-2025', '2025-01-01', '2025-03-31', false, 2),
('Trimestre 3', 'trimester', '2024-2025', '2025-04-01', '2025-06-30', false, 3)
ON CONFLICT DO NOTHING;
