// =============================================================================
// Smart Grid — Mock Data Generator
// Generates 50K rows × 50 columns for performance testing.
// =============================================================================

import type { ColumnDef, Row } from '@smart-grid/core';

const FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank',
  'Ivy', 'Jack', 'Karen', 'Leo', 'Mona', 'Nate', 'Olive', 'Paul',
  'Quinn', 'Rose', 'Sam', 'Tina', 'Uma', 'Vince', 'Wendy', 'Xander',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
];

const DEPARTMENTS = [
  'Engineering', 'Sales', 'Marketing', 'Support', 'HR', 'Finance',
  'Legal', 'Operations', 'Product', 'Design',
];

const STATUSES = ['Active', 'Inactive', 'Pending', 'Suspended'];

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Generates column definitions.
 */
export function generateColumns(count: number): ColumnDef[] {
  const columns: ColumnDef[] = [
    { id: 'id', field: 'id', header: 'ID', width: 70, sortable: true },
    { id: 'firstName', field: 'firstName', header: 'First Name', width: 120, sortable: true, filterable: true },
    { id: 'lastName', field: 'lastName', header: 'Last Name', width: 120, sortable: true, filterable: true },
    { id: 'email', field: 'email', header: 'Email', width: 200, sortable: true },
    { id: 'department', field: 'department', header: 'Department', width: 130, sortable: true, filterable: true },
    { id: 'status', field: 'status', header: 'Status', width: 100, sortable: true },
    { id: 'salary', field: 'salary', header: 'Salary', width: 100, sortable: true },
    { id: 'startDate', field: 'startDate', header: 'Start Date', width: 110 },
    { id: 'rating', field: 'rating', header: 'Rating', width: 80 },
    { id: 'projects', field: 'projects', header: 'Projects', width: 90 },
  ];

  // Generate additional generic columns to reach the desired count
  for (let i = columns.length; i < count; i++) {
    columns.push({
      id: `col_${i}`,
      field: `col_${i}`,
      header: `Column ${i + 1}`,
      width: 100,
      sortable: true,
    });
  }

  return columns;
}

/**
 * Generates row data.
 */
export function generateRows(count: number, columnCount: number): Row[] {
  const rows: Row[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const firstName = randomFrom(FIRST_NAMES);
    const lastName = randomFrom(LAST_NAMES);

    const row: Record<string, string | number | boolean | null> = {
      id: i + 1,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@company.com`,
      department: randomFrom(DEPARTMENTS),
      status: randomFrom(STATUSES),
      salary: Math.floor(40000 + Math.random() * 120000),
      startDate: `${2015 + Math.floor(Math.random() * 10)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
      rating: Math.round((1 + Math.random() * 4) * 10) / 10,
      projects: Math.floor(Math.random() * 20),
    };

    // Fill additional columns
    for (let c = 10; c < columnCount; c++) {
      row[`col_${c}`] = `R${i + 1}C${c + 1}`;
    }

    rows[i] = row;
  }

  return rows;
}
